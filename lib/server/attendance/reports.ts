// Attendance reporting/analytics (Phase 5B) — production, PostgreSQL-backed.
// Powers the Attendance dashboard + reports pages. Every number here is derived
// from the real Academics Foundation (Section/Class/Enrollment) and historical
// AttendanceSession/AttendanceRecord rows, using the SINGLE canonical summary
// formula from ./service (computeSummary). There is no second percentage rule.
//
// AUTHORIZATION: read/reporting surface — requireAttendanceFeature + the caller's
// validated OrgScope (tenant/school/branch/academic-session). Routes additionally
// enforce the `attendance.view` permission. Nothing is trusted from query params:
// classId/sectionId only ever *narrow* an already scope-constrained query, so a
// foreign id simply matches nothing (cross-tenant isolation is structural).
//
// ATTENDANCE POLICY: in Phase 5B the shortage / consecutive-absence thresholds are
// READ-ONLY server defaults (ATTENDANCE_POLICY below) — the dashboard's Rules
// drawer displays them but cannot mutate them, and there is zero mock/localStorage
// fallback. Persistent, school-configurable Attendance Policy is deferred to a
// dedicated settings phase (no AttendanceRule DB model is introduced here).
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";
import {
  computeSummary,
  dateToUi,
  parseAttendanceDate,
  requireAttendanceFeature,
  serverToday,
} from "./service";
import type {
  AttendanceDashboardDto,
  AttendancePolicyDto,
  AttendanceReportDto,
  AttendanceReportRow,
  AttendanceReportType,
} from "@/lib/api/contracts";

/** Effective, read-only attendance policy (Phase 5B server defaults). */
export const ATTENDANCE_POLICY: AttendancePolicyDto = {
  shortageThresholdPct: 75,
  consecutiveAbsenceThreshold: 3,
};

/** Reporting requires a selected academic session. */
function requireSession(scope: OrgScope): string {
  if (!scope.academicSessionId) throw new HttpError("INVALID_SESSION", "Select an academic session first");
  return scope.academicSessionId;
}

/** Base session scope filter (tenant is implied by school; branch when set). */
function sessionScope(scope: OrgScope): Prisma.AttendanceSessionWhereInput {
  const where: Prisma.AttendanceSessionWhereInput = { schoolId: scope.schoolId, academicSessionId: requireSession(scope) };
  if (scope.branchId) where.branchId = scope.branchId;
  return where;
}

type DateRange = { dateFrom?: string; dateTo?: string };
function dateFilter(range: DateRange): Prisma.DateTimeFilter | undefined {
  if (!range.dateFrom && !range.dateTo) return undefined;
  const f: Prisma.DateTimeFilter = {};
  if (range.dateFrom) f.gte = parseAttendanceDate(range.dateFrom);
  if (range.dateTo) f.lte = parseAttendanceDate(range.dateTo);
  return f;
}

// ── Per-student grouping helpers (single-query, Map-based; no N+1) ────────────

type DatedStatus = { status: string; date: Date };

/** Group scope-wide records by student → [{status, date}] (one query upstream). */
function groupByStudent(rows: { studentId: string; status: string; date: Date }[]): Map<string, DatedStatus[]> {
  const m = new Map<string, DatedStatus[]>();
  for (const r of rows) {
    const arr = m.get(r.studentId) ?? [];
    arr.push({ status: r.status, date: r.date });
    m.set(r.studentId, arr);
  }
  return m;
}

/** Leading ABSENT streak (records sorted date-desc) — the consecutive-absence rule. */
function leadingAbsentStreak(recs: DatedStatus[]): number {
  const sorted = [...recs].sort((a, b) => b.date.getTime() - a.date.getTime());
  let streak = 0;
  for (const r of sorted) {
    if (r.status === "ABSENT") streak += 1;
    else break;
  }
  return streak;
}

/** Load name + current-enrollment class/section for a set of students (Map-based). */
async function loadStudentMeta(scope: OrgScope, studentIds: string[]) {
  if (studentIds.length === 0) return new Map<string, { name: string; admissionNumber: string; className: string; sectionName: string }>();
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds }, schoolId: scope.schoolId },
    select: {
      id: true, firstName: true, lastName: true, admissionNumber: true,
      enrollments: {
        where: { academicSessionId: requireSession(scope), status: "ENROLLED", ...(scope.branchId ? { branchId: scope.branchId } : {}) },
        select: { section: { select: { name: true, class: { select: { name: true } } } } },
        take: 1,
      },
    },
  });
  return new Map(students.map((s) => [s.id, {
    name: `${s.firstName} ${s.lastName}`.trim(),
    admissionNumber: s.admissionNumber,
    className: s.enrollments[0]?.section.class.name ?? "—",
    sectionName: s.enrollments[0]?.section.name ?? "—",
  }]));
}

// ── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboard(scope: OrgScope): Promise<AttendanceDashboardDto> {
  await requireAttendanceFeature(scope);
  const today = serverToday();
  const todayDate = parseAttendanceDate(today);

  const [todaySessions, totalSections, allRecords] = await Promise.all([
    // Today's sessions (for present%, late-today, marked/pending sections).
    prisma.attendanceSession.findMany({
      where: { ...sessionScope(scope), date: todayDate },
      select: { status: true, records: { select: { status: true } } },
    }),
    // Eligible sections: active + at least one ENROLLED student.
    prisma.section.count({
      where: {
        schoolId: scope.schoolId, academicSessionId: requireSession(scope), status: "ACTIVE",
        ...(scope.branchId ? { branchId: scope.branchId } : {}),
        enrollments: { some: { status: "ENROLLED" } },
      },
    }),
    // All records this academic session (below-minimum + consecutive-absence risk).
    prisma.attendanceRecord.findMany({
      where: { session: sessionScope(scope) },
      select: { studentId: true, status: true, session: { select: { date: true } } },
    }),
  ]);

  const todayRecords = todaySessions.flatMap((s) => s.records);
  const presentTodayPct = computeSummary(todayRecords).attendancePercentage;
  const lateToday = todayRecords.filter((r) => r.status === "LATE").length;
  const markedSections = todaySessions.filter((s) => s.status === "SUBMITTED" || s.status === "LOCKED").length;
  const pendingSections = Math.max(0, totalSections - markedSections);

  const byStudent = groupByStudent(allRecords.map((r) => ({ studentId: r.studentId, status: r.status, date: r.session.date })));
  let belowMinimumCount = 0;
  let consecutiveAbsenceRiskCount = 0;
  for (const recs of byStudent.values()) {
    const pct = computeSummary(recs).attendancePercentage;
    if (pct !== null && pct < ATTENDANCE_POLICY.shortageThresholdPct) belowMinimumCount += 1;
    if (leadingAbsentStreak(recs) >= ATTENDANCE_POLICY.consecutiveAbsenceThreshold) consecutiveAbsenceRiskCount += 1;
  }

  return {
    date: today, presentTodayPct, lateToday, belowMinimumCount, consecutiveAbsenceRiskCount,
    totalSections, markedSections, pendingSections, policy: ATTENDANCE_POLICY,
  };
}

// ── Reports ──────────────────────────────────────────────────────────────────

export type ReportParams = DateRange & { type: AttendanceReportType; classId?: string; sectionId?: string };

/** Section/class narrowing applied to the session scope of a report query. */
function narrow(scope: OrgScope, p: ReportParams, range: DateRange = p): Prisma.AttendanceSessionWhereInput {
  const where = sessionScope(scope);
  if (p.sectionId) where.sectionId = p.sectionId;
  if (p.classId) where.section = { classId: p.classId };
  const df = dateFilter(range);
  if (df) where.date = df;
  return where;
}

export async function getReport(scope: OrgScope, p: ReportParams): Promise<AttendanceReportDto> {
  await requireAttendanceFeature(scope);
  switch (p.type) {
    case "daily": return dailyReport(scope, p);
    case "monthly-trend": return trendReport(scope, p);
    case "class": return classReport(scope, p);
    case "shortage": return shortageReport(scope, p);
    case "late-arrival": return lateArrivalReport(scope, p);
    case "consecutive-absence": return consecutiveAbsenceReport(scope, p);
    default: throw new HttpError("VALIDATION_ERROR", `Unknown report type "${p.type}"`);
  }
}

async function dailyReport(scope: OrgScope, p: ReportParams): Promise<AttendanceReportDto> {
  const today = serverToday();
  const sessions = await prisma.attendanceSession.findMany({
    where: narrow(scope, p, { dateFrom: today, dateTo: today }),
    select: {
      status: true, markedByName: true,
      section: { select: { name: true, class: { select: { name: true, order: true } } } },
      records: { select: { status: true } },
    },
    orderBy: [{ section: { class: { order: "asc" } } }, { section: { name: "asc" } }],
  });
  const rows: AttendanceReportRow[] = sessions.map((s) => {
    const sum = computeSummary(s.records);
    return {
      Class: s.section.class.name, Section: s.section.name,
      Present: sum.present, Absent: sum.absent, Late: sum.late,
      "Attendance %": sum.attendancePercentage ?? 0, "Marked by": s.markedByName ?? "—",
    };
  });
  return { type: "daily", columns: ["Class", "Section", "Present", "Absent", "Late", "Attendance %", "Marked by"], rows, threshold: null };
}

async function trendReport(scope: OrgScope, p: ReportParams): Promise<AttendanceReportDto> {
  const DAYS = 14;
  const start = new Date(`${serverToday()}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - (DAYS - 1));
  const sessions = await prisma.attendanceSession.findMany({
    where: { ...narrow(scope, p, {}), date: { gte: start } },
    select: { date: true, records: { select: { status: true } } },
  });
  const byDate = new Map<string, { status: string }[]>();
  for (const s of sessions) {
    const key = dateToUi(s.date);
    byDate.set(key, [...(byDate.get(key) ?? []), ...s.records]);
  }
  const rows: AttendanceReportRow[] = [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, recs]) => ({ Date: date, "Present %": computeSummary(recs).attendancePercentage ?? 0 }));
  return { type: "monthly-trend", columns: ["Date", "Present %"], rows, threshold: null };
}

async function classReport(scope: OrgScope, p: ReportParams): Promise<AttendanceReportDto> {
  const sessions = await prisma.attendanceSession.findMany({
    where: narrow(scope, p),
    select: {
      sectionId: true,
      section: { select: { name: true, class: { select: { name: true, order: true } } } },
      records: { select: { status: true } },
    },
  });
  type Acc = { className: string; sectionName: string; order: number; records: { status: string }[] };
  const bySection = new Map<string, Acc>();
  for (const s of sessions) {
    const acc = bySection.get(s.sectionId) ?? { className: s.section.class.name, sectionName: s.section.name, order: s.section.class.order, records: [] };
    acc.records.push(...s.records);
    bySection.set(s.sectionId, acc);
  }
  const rows: AttendanceReportRow[] = [...bySection.values()]
    .sort((a, b) => a.order - b.order || a.sectionName.localeCompare(b.sectionName))
    .map((a) => {
      const sum = computeSummary(a.records);
      return { Class: a.className, Section: a.sectionName, Sessions: a.records.length, "Attendance %": sum.attendancePercentage ?? 0 };
    });
  return { type: "class", columns: ["Class", "Section", "Sessions", "Attendance %"], rows, threshold: null };
}

/** Per-student aggregate over historical records (authority = AttendanceRecord). */
async function studentAggregates(scope: OrgScope, p: ReportParams) {
  const records = await prisma.attendanceRecord.findMany({
    where: { session: narrow(scope, p) },
    select: { studentId: true, status: true },
  });
  const byStudent = new Map<string, { status: string }[]>();
  for (const r of records) byStudent.set(r.studentId, [...(byStudent.get(r.studentId) ?? []), { status: r.status }]);
  const meta = await loadStudentMeta(scope, [...byStudent.keys()]);
  return [...byStudent.entries()].map(([studentId, recs]) => {
    const m = meta.get(studentId);
    return {
      studentId,
      name: m?.name ?? "—", admissionNumber: m?.admissionNumber ?? "—",
      className: m?.className ?? "—", sectionName: m?.sectionName ?? "—",
      summary: computeSummary(recs),
    };
  });
}

async function shortageReport(scope: OrgScope, p: ReportParams): Promise<AttendanceReportDto> {
  const threshold = ATTENDANCE_POLICY.shortageThresholdPct;
  const aggregates = await studentAggregates(scope, p);
  const rows: AttendanceReportRow[] = aggregates
    // Zero-session students have a null percentage and are NOT flagged (§9).
    .filter((a) => a.summary.attendancePercentage !== null && a.summary.attendancePercentage < threshold)
    .sort((a, b) => (a.summary.attendancePercentage ?? 0) - (b.summary.attendancePercentage ?? 0))
    .map((a) => ({
      Student: a.name, "Admission No.": a.admissionNumber, Class: a.className, Section: a.sectionName,
      Sessions: a.summary.total, "Attendance %": a.summary.attendancePercentage ?? 0,
    }));
  return { type: "shortage", columns: ["Student", "Admission No.", "Class", "Section", "Sessions", "Attendance %"], rows, threshold };
}

async function lateArrivalReport(scope: OrgScope, p: ReportParams): Promise<AttendanceReportDto> {
  const records = await prisma.attendanceRecord.findMany({
    where: { status: "LATE", session: narrow(scope, p) },
    select: { student: { select: { firstName: true, lastName: true } }, session: { select: { date: true, section: { select: { name: true, class: { select: { name: true } } } } } } },
    orderBy: [{ session: { date: "desc" } }],
    take: 500,
  });
  const rows: AttendanceReportRow[] = records.map((r) => ({
    Student: `${r.student.firstName} ${r.student.lastName}`.trim(),
    Class: r.session.section.class.name, Section: r.session.section.name, Date: dateToUi(r.session.date),
  }));
  return { type: "late-arrival", columns: ["Student", "Class", "Section", "Date"], rows, threshold: null };
}

async function consecutiveAbsenceReport(scope: OrgScope, p: ReportParams): Promise<AttendanceReportDto> {
  const threshold = ATTENDANCE_POLICY.consecutiveAbsenceThreshold;
  const records = await prisma.attendanceRecord.findMany({
    where: { session: narrow(scope, p) },
    select: { studentId: true, status: true, session: { select: { date: true } } },
  });
  const byStudent = groupByStudent(records.map((r) => ({ studentId: r.studentId, status: r.status, date: r.session.date })));
  const atRisk: { studentId: string; streak: number }[] = [];
  for (const [studentId, recs] of byStudent) {
    const streak = leadingAbsentStreak(recs);
    if (streak >= threshold) atRisk.push({ studentId, streak });
  }
  const meta = await loadStudentMeta(scope, atRisk.map((a) => a.studentId));
  const rows: AttendanceReportRow[] = atRisk
    .sort((a, b) => b.streak - a.streak)
    .map((a) => {
      const m = meta.get(a.studentId);
      return { Student: m?.name ?? "—", Class: m?.className ?? "—", Section: m?.sectionName ?? "—", "Consecutive absences": a.streak };
    });
  return { type: "consecutive-absence", columns: ["Student", "Class", "Section", "Consecutive absences"], rows, threshold };
}
