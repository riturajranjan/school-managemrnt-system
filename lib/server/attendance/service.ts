// Attendance service (Phase 5) — production, PostgreSQL-backed. Keyed on the real
// Academics Foundation (Section + Enrollment), never label strings. Every call is
// constrained to the caller's validated OrgScope + the `attendance` feature.
//
// AUTHORIZATION CHAIN (routes): requireAuth → requireOrgScope → requirePermission
// (attendance.view/mark) → requireAttendanceFeature → target Section ownership.
//
// DATE STRATEGY: attendance date is a school-local calendar day supplied as
// "YYYY-MM-DD"; it is normalized to UTC-midnight for the date-only column so
// browser timezones can never shift the day. Reads return "YYYY-MM-DD".
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { hasFeature } from "@/lib/server/platform/features-service";
import type { OrgScope } from "@/lib/server/api/scope";
import type {
  AttendanceHistoryItemDto,
  AttendanceRosterEntryDto,
  AttendanceSessionDto,
  AttendanceSessionViewDto,
  AttendanceSummaryDto,
  StudentAttendanceSummaryDto,
} from "@/lib/api/contracts";

// UI kebab ↔ DB enum.
const STATUS_TO_DB: Record<string, string> = {
  present: "PRESENT", absent: "ABSENT", late: "LATE", excused: "EXCUSED",
  "half-day": "HALF_DAY", "medical-leave": "MEDICAL_LEAVE", "official-duty": "OFFICIAL_DUTY",
};
const statusToUi = (s: string) => s.toLowerCase().replace(/_/g, "-");
export const VALID_STATUSES = Object.keys(STATUS_TO_DB);

/** Attendance requires a selected academic session. */
function requireSession(scope: OrgScope): string {
  if (!scope.academicSessionId) throw new HttpError("INVALID_SESSION", "Select an academic session first");
  return scope.academicSessionId;
}

/** Fail closed unless the school's effective plan includes the attendance feature. */
export async function requireAttendanceFeature(scope: OrgScope): Promise<void> {
  if (!(await hasFeature(scope.schoolId, "attendance"))) {
    throw new HttpError("FEATURE_DISABLED", "Attendance is not enabled for this school's plan");
  }
}

/** Normalize "YYYY-MM-DD" → UTC-midnight Date for the date-only column. */
export function parseAttendanceDate(dateStr: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) throw new HttpError("ATTENDANCE_DATE_INVALID", "Date must be YYYY-MM-DD");
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) throw new HttpError("ATTENDANCE_DATE_INVALID", "Invalid date");
  return d;
}
export const dateToUi = (d: Date) => d.toISOString().slice(0, 10);

/** School-local "today" as YYYY-MM-DD, derived server-side (never browser tz). */
export const serverToday = (): string => new Date().toISOString().slice(0, 10);

// ── Summary (the single central calculation) ────────────────────────────────
// attendancePercentage = (present + late + 0.5·half-day) / total · 100.
// LATE counts as attended; HALF_DAY as half; ABSENT/EXCUSED/MEDICAL_LEAVE/
// OFFICIAL_DUTY as not-attended. total = 0 → null.
export function computeSummary(records: { status: string }[]): AttendanceSummaryDto {
  const c = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0, HALF_DAY: 0, MEDICAL_LEAVE: 0, OFFICIAL_DUTY: 0 } as Record<string, number>;
  for (const r of records) c[r.status] = (c[r.status] ?? 0) + 1;
  const total = records.length;
  const pct = total === 0 ? null : Math.round(((c.PRESENT + c.LATE + 0.5 * c.HALF_DAY) / total) * 100);
  return {
    total, present: c.PRESENT, absent: c.ABSENT, late: c.LATE, excused: c.EXCUSED,
    halfDay: c.HALF_DAY, medicalLeave: c.MEDICAL_LEAVE, officialDuty: c.OFFICIAL_DUTY, attendancePercentage: pct,
  };
}

type SectionWithClass = { id: string; name: string; schoolId: string; branchId: string; academicSessionId: string; classId: string; class: { id: string; name: string } };

/** Load a Section and verify it belongs to the caller's scope. */
async function requireSectionInScope(scope: OrgScope, sectionId: string): Promise<SectionWithClass> {
  const section = await prisma.section.findFirst({
    where: { id: sectionId, schoolId: scope.schoolId, academicSessionId: requireSession(scope), ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    select: { id: true, name: true, schoolId: true, branchId: true, academicSessionId: true, classId: true, class: { select: { id: true, name: true } } },
  });
  if (!section) throw new HttpError("INVALID_SCHOOL", "Section not found or not accessible");
  return section;
}

/** ENROLLED roster for a section (real Enrollment rows → Student). */
async function loadRoster(sectionId: string) {
  return prisma.enrollment.findMany({
    where: { sectionId, status: "ENROLLED" },
    select: { id: true, studentId: true, rollNumber: true, student: { select: { firstName: true, lastName: true, admissionNumber: true, rollNumber: true } } },
    orderBy: [{ student: { firstName: "asc" } }],
  });
}

function sessionDto(session: { id: string; date: Date; type?: string; status: string; markedByName: string | null; submittedAt: Date | null; lockedAt: Date | null }, cls: { id: string; name: string }, sec: { id: string; name: string }, summary: AttendanceSummaryDto): AttendanceSessionDto {
  return {
    id: session.id, date: dateToUi(session.date), type: (session.type ?? "DAILY").toLowerCase() as "daily" | "period",
    status: session.status.toLowerCase(),
    class: cls, section: sec, markedByName: session.markedByName,
    submittedAt: session.submittedAt ? session.submittedAt.toISOString() : null,
    lockedAt: session.lockedAt ? session.lockedAt.toISOString() : null,
    summary,
  };
}

// ── Read: section + date view (roster + existing records) ────────────────────

export async function getSessionView(scope: OrgScope, sectionId: string, dateStr: string): Promise<AttendanceSessionViewDto> {
  await requireAttendanceFeature(scope);
  const section = await requireSectionInScope(scope, sectionId);
  const date = parseAttendanceDate(dateStr);

  const [session, roster] = await Promise.all([
    // DAILY register for this section+date (partial-unique enforced; findFirst since
    // the compound unique is now a partial index Prisma cannot address by key).
    prisma.attendanceSession.findFirst({
      where: { sectionId, date, type: "DAILY" },
      include: { records: { select: { studentId: true, status: true, remarks: true } } },
    }),
    loadRoster(sectionId),
  ]);

  const recByStudent = new Map((session?.records ?? []).map((r) => [r.studentId, r]));
  const rosterDto: AttendanceRosterEntryDto[] = roster.map((e) => {
    const rec = recByStudent.get(e.studentId);
    return {
      studentId: e.studentId, enrollmentId: e.id,
      name: `${e.student.firstName} ${e.student.lastName}`.trim(),
      admissionNumber: e.student.admissionNumber, rollNumber: e.rollNumber ?? e.student.rollNumber,
      status: rec ? statusToUi(rec.status) : null, remarks: rec?.remarks ?? null,
    };
  });
  const summary = computeSummary(session?.records ?? []);
  const cls = { id: section.class.id, name: section.class.name };
  const sec = { id: section.id, name: section.name };
  return {
    session: session ? sessionDto(session, cls, sec, summary) : null,
    date: dateStr, type: "daily", class: cls, section: sec, roster: rosterDto, summary,
  };
}

// ── Period session view + contextual authorization (Phase 7C) ────────────────

/** Columns loaded for a PERIOD session (id + status + immutable lesson snapshot). */
export const PERIOD_SESSION_SELECT = {
  id: true, sectionId: true, date: true, type: true, status: true, markedByName: true, submittedAt: true, lockedAt: true,
  timetableEntryId: true, periodId: true, periodName: true, subjectId: true, subjectCode: true, subjectName: true, staffId: true, staffName: true,
  records: { select: { studentId: true, status: true, remarks: true } },
} satisfies Prisma.AttendanceSessionSelect;
type PeriodSessionRow = Prisma.AttendanceSessionGetPayload<{ select: typeof PERIOD_SESSION_SELECT }>;

/** Build the grid view for a PERIOD session (roster from real Enrollment + lesson snapshot). */
export async function periodSessionView(scope: OrgScope, session: PeriodSessionRow): Promise<AttendanceSessionViewDto> {
  const section = await requireSectionInScope(scope, session.sectionId);
  const roster = await loadRoster(section.id);
  const recByStudent = new Map(session.records.map((r) => [r.studentId, r]));
  const rosterDto: AttendanceRosterEntryDto[] = roster.map((e) => {
    const rec = recByStudent.get(e.studentId);
    return {
      studentId: e.studentId, enrollmentId: e.id, name: `${e.student.firstName} ${e.student.lastName}`.trim(),
      admissionNumber: e.student.admissionNumber, rollNumber: e.rollNumber ?? e.student.rollNumber,
      status: rec ? statusToUi(rec.status) : null, remarks: rec?.remarks ?? null,
    };
  });
  const summary = computeSummary(session.records);
  const cls = { id: section.class.id, name: section.class.name };
  const sec = { id: section.id, name: section.name };
  const lesson = {
    timetableEntryId: session.timetableEntryId,
    subject: { id: session.subjectId, code: session.subjectCode, name: session.subjectName },
    period: { id: session.periodId, name: session.periodName },
    teacher: { id: session.staffId, name: session.staffName },
  };
  return {
    session: { ...sessionDto(session, cls, sec, summary), lesson },
    date: dateToUi(session.date), type: "period", class: cls, section: sec, roster: rosterDto, summary, lesson,
  };
}

/** True if the actor holds a broad attendance-managing role (SCHOOL_ADMIN/PRINCIPAL). */
async function isBroadAttendanceManager(scope: OrgScope): Promise<boolean> {
  const m = await prisma.roleAssignment.findFirst({
    where: { membership: { userId: scope.actor.id, tenantId: scope.tenantId, status: "ACTIVE" }, role: { key: { in: ["SCHOOL_ADMIN", "PRINCIPAL"] } } },
    select: { id: true },
  });
  return Boolean(m);
}

/** Contextual authz for mutating a PERIOD session: a teacher may mutate only their
 *  OWN lesson (their linked Staff = the lesson's teacher); admins/principals broad. */
export async function assertCanMutatePeriodSession(scope: OrgScope, session: { type: string; staffId: string | null }): Promise<void> {
  if (session.type !== "PERIOD") return;
  if (await isBroadAttendanceManager(scope)) return;
  const staff = await prisma.staff.findFirst({ where: { userId: scope.actor.id, schoolId: scope.schoolId }, select: { id: true } });
  if (staff && session.staffId && staff.id === session.staffId) return;
  throw new HttpError("FORBIDDEN", "You can only mark attendance for your own scheduled lessons");
}

// ── Get-or-create session (race-safe) ────────────────────────────────────────

export async function createOrGetSession(scope: OrgScope, sectionId: string, dateStr: string, actor: { id: string; name: string | null }): Promise<AttendanceSessionViewDto> {
  await requireAttendanceFeature(scope);
  const section = await requireSectionInScope(scope, sectionId);
  const date = parseAttendanceDate(dateStr);

  const existing = await prisma.attendanceSession.findFirst({ where: { sectionId, date, type: "DAILY" }, select: { id: true } });
  if (!existing) {
    try {
      await prisma.$transaction(async (tx) => {
        const created = await tx.attendanceSession.create({
          data: { tenantId: scope.tenantId, schoolId: section.schoolId, branchId: section.branchId, academicSessionId: section.academicSessionId, sectionId, date, type: "DAILY", status: "DRAFT", markedByUserId: actor.id, markedByName: actor.name },
        });
        await recordAudit(tx, scope, "ATTENDANCE_SESSION_CREATED", "AttendanceSession", created.id, { sectionId, date: dateStr });
      });
    } catch (e) {
      // Concurrent create → partial-unique(DAILY, sectionId, date) violation → fall through to read.
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
  }
  return getSessionView(scope, sectionId, dateStr);
}

// ── Session detail by id ─────────────────────────────────────────────────────

async function requireSessionInScope(scope: OrgScope, sessionId: string) {
  const s = await prisma.attendanceSession.findFirst({
    where: { id: sessionId, schoolId: scope.schoolId, academicSessionId: requireSession(scope), ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    select: { id: true, sectionId: true, status: true, type: true, staffId: true },
  });
  if (!s) throw new HttpError("ATTENDANCE_SESSION_NOT_FOUND", "Attendance session not found");
  return s;
}

/** Type-aware session view by id (DAILY → section+date view; PERIOD → lesson view). */
export async function getSessionDetail(scope: OrgScope, sessionId: string): Promise<AttendanceSessionViewDto> {
  await requireAttendanceFeature(scope);
  const s = await prisma.attendanceSession.findFirst({
    where: { id: sessionId, schoolId: scope.schoolId, academicSessionId: requireSession(scope), ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    select: PERIOD_SESSION_SELECT,
  });
  if (!s) throw new HttpError("ATTENDANCE_SESSION_NOT_FOUND", "Attendance session not found");
  if (s.type === "PERIOD") return periodSessionView(scope, s);
  return getSessionView(scope, s.sectionId, dateToUi(s.date));
}

// ── Bulk marking ─────────────────────────────────────────────────────────────

export async function saveRecords(scope: OrgScope, sessionId: string, records: { studentId: string; status: string; remarks?: string | null }[], actor: { id: string; name: string | null }): Promise<AttendanceSessionViewDto> {
  await requireAttendanceFeature(scope);
  const session = await prisma.attendanceSession.findFirst({
    where: { id: sessionId, schoolId: scope.schoolId, academicSessionId: requireSession(scope), ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    select: { id: true, sectionId: true, status: true, date: true, type: true, staffId: true },
  });
  if (!session) throw new HttpError("ATTENDANCE_SESSION_NOT_FOUND", "Attendance session not found");
  await assertCanMutatePeriodSession(scope, session); // teacher-ownership for PERIOD sessions
  if (session.status === "LOCKED") throw new HttpError("ATTENDANCE_ALREADY_LOCKED", "This attendance session is locked");

  // Validate statuses + resolve every student's ENROLLED enrollment in THIS section.
  const unique = new Map<string, { status: string; remarks?: string | null }>();
  for (const r of records) {
    if (!VALID_STATUSES.includes(r.status)) throw new HttpError("VALIDATION_ERROR", `Invalid status "${r.status}"`);
    unique.set(r.studentId, { status: r.status, remarks: r.remarks });
  }
  const studentIds = [...unique.keys()];
  const enrollments = await prisma.enrollment.findMany({
    where: { sectionId: session.sectionId, status: "ENROLLED", studentId: { in: studentIds.length ? studentIds : ["__none__"] } },
    select: { id: true, studentId: true },
  });
  const enrByStudent = new Map(enrollments.map((e) => [e.studentId, e.id]));
  for (const sid of studentIds) {
    if (!enrByStudent.has(sid)) throw new HttpError("STUDENT_NOT_IN_SECTION", "A student is not enrolled in this section");
  }

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    for (const [studentId, { status, remarks }] of unique) {
      await tx.attendanceRecord.upsert({
        where: { attendanceSessionId_studentId: { attendanceSessionId: sessionId, studentId } },
        update: { status: STATUS_TO_DB[status] as never, remarks: remarks ?? null, markedAt: now },
        create: { attendanceSessionId: sessionId, studentId, enrollmentId: enrByStudent.get(studentId)!, status: STATUS_TO_DB[status] as never, remarks: remarks ?? null, markedAt: now },
      });
    }
    await tx.attendanceSession.update({ where: { id: sessionId }, data: { markedByUserId: actor.id, markedByName: actor.name } });
    await recordAudit(tx, scope, "ATTENDANCE_UPDATED", "AttendanceSession", sessionId, { type: session.type, recordCount: unique.size, date: dateToUi(session.date) });
  });

  return getSessionDetail(scope, sessionId); // type-aware view (daily or period)
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

export async function submitSession(scope: OrgScope, sessionId: string): Promise<AttendanceSessionViewDto> {
  await requireAttendanceFeature(scope);
  const s = await requireSessionInScope(scope, sessionId);
  await assertCanMutatePeriodSession(scope, s);
  if (s.status === "LOCKED") throw new HttpError("ATTENDANCE_ALREADY_LOCKED", "This attendance session is locked");
  await prisma.$transaction(async (tx) => {
    await tx.attendanceSession.update({ where: { id: sessionId }, data: { status: "SUBMITTED", submittedAt: new Date() } });
    await recordAudit(tx, scope, "ATTENDANCE_SUBMITTED", "AttendanceSession", sessionId);
  });
  return getSessionDetail(scope, sessionId);
}

export async function lockSession(scope: OrgScope, sessionId: string): Promise<AttendanceSessionViewDto> {
  await requireAttendanceFeature(scope);
  const s = await requireSessionInScope(scope, sessionId);
  await assertCanMutatePeriodSession(scope, s);
  if (s.status === "LOCKED") throw new HttpError("INVALID_ATTENDANCE_TRANSITION", "Session is already locked");
  await prisma.$transaction(async (tx) => {
    await tx.attendanceSession.update({ where: { id: sessionId }, data: { status: "LOCKED", lockedAt: new Date() } });
    await recordAudit(tx, scope, "ATTENDANCE_LOCKED", "AttendanceSession", sessionId);
  });
  return getSessionDetail(scope, sessionId);
}

// ── History (paginated, server-filtered) ─────────────────────────────────────

export type HistoryParams = { page: number; pageSize: number; classId?: string; sectionId?: string; status?: string; dateFrom?: string; dateTo?: string };

export async function listHistory(scope: OrgScope, params: HistoryParams): Promise<{ data: AttendanceHistoryItemDto[]; meta: { page: number; pageSize: number; total: number; totalPages: number } }> {
  await requireAttendanceFeature(scope);
  // Register/history is the DAILY attendance record (period attendance has its own
  // reporting — daily and period denominators are kept separate, plan §17).
  const where: Prisma.AttendanceSessionWhereInput = { schoolId: scope.schoolId, academicSessionId: requireSession(scope), type: "DAILY" };
  if (scope.branchId) where.branchId = scope.branchId;
  if (params.sectionId) where.sectionId = params.sectionId;
  if (params.status) where.status = params.status.toUpperCase() as never;
  if (params.classId) where.section = { classId: params.classId };
  if (params.dateFrom || params.dateTo) {
    where.date = {};
    if (params.dateFrom) (where.date as Prisma.DateTimeFilter).gte = parseAttendanceDate(params.dateFrom);
    if (params.dateTo) (where.date as Prisma.DateTimeFilter).lte = parseAttendanceDate(params.dateTo);
  }
  const [rows, total] = await Promise.all([
    prisma.attendanceSession.findMany({
      where, orderBy: [{ date: "desc" }], skip: (params.page - 1) * params.pageSize, take: params.pageSize,
      include: { section: { select: { id: true, name: true, class: { select: { id: true, name: true } } } }, records: { select: { status: true } } },
    }),
    prisma.attendanceSession.count({ where }),
  ]);
  return {
    data: rows.map((r) => sessionDto(r, { id: r.section.class.id, name: r.section.class.name }, { id: r.section.id, name: r.section.name }, computeSummary(r.records))),
    meta: { page: params.page, pageSize: params.pageSize, total, totalPages: Math.max(1, Math.ceil(total / params.pageSize)) },
  };
}

// ── Student attendance history (Student 360) ─────────────────────────────────

export async function studentAttendance(scope: OrgScope, studentId: string, opts: { limit?: number } = {}): Promise<StudentAttendanceSummaryDto> {
  await requireAttendanceFeature(scope);
  // Confirm the student belongs to the caller's school (scope), else 404.
  const student = await prisma.student.findFirst({ where: { id: studentId, schoolId: scope.schoolId }, select: { id: true } });
  if (!student) throw new HttpError("NOT_FOUND", "Student not found");

  // Student-360 daily summary counts DAILY sessions only (period attendance is
  // presented separately with its own denominator — plan §18).
  const records = await prisma.attendanceRecord.findMany({
    where: { studentId, session: { academicSessionId: requireSession(scope), schoolId: scope.schoolId, type: "DAILY" } },
    select: { status: true, remarks: true, session: { select: { date: true, section: { select: { id: true, name: true, class: { select: { name: true } } } } } } },
    orderBy: [{ session: { date: "desc" } }],
  });
  const summary = computeSummary(records);
  const recent = records.slice(0, opts.limit ?? 30).map((r) => ({
    date: dateToUi(r.session.date), status: statusToUi(r.status), remarks: r.remarks,
    section: { id: r.session.section.id, name: r.session.section.name }, className: r.session.section.class.name,
  }));
  return { summary: { ...summary, records: records.length }, recent };
}
