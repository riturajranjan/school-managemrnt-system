// Period / subject attendance (Phase 7C) — real, PostgreSQL-backed. Extends the
// existing Attendance engine (same AttendanceSession/Record, same statuses,
// submit/lock lifecycle, same roster from real Enrollment) with sessions bound to
// a real TimetableEntry. A PERIOD session is ALWAYS created from a scheduled
// lesson (never a free-form subject/teacher/period), its weekday is validated
// against the attendance date server-side, and the subject/period/teacher are
// SNAPSHOTTED onto the session so history survives later timetable/subject/staff
// changes. Concurrency-safe via the partial unique index (timetableEntryId, date).
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import type { OrgScope } from "@/lib/server/api/scope";
import type { AttendanceSessionViewDto, PeriodLessonDto, Weekday } from "@/lib/api/contracts";
import {
  PERIOD_SESSION_SELECT, assertCanMutatePeriodSession, parseAttendanceDate,
  periodSessionView, requireAttendanceFeature,
} from "./service";

// Attendance date "YYYY-MM-DD" → Weekday enum (server-derived; never browser).
const DAY_ENUM: Weekday[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const DAY_TO_DB: Record<Weekday, string> = { sunday: "SUNDAY", monday: "MONDAY", tuesday: "TUESDAY", wednesday: "WEDNESDAY", thursday: "THURSDAY", friday: "FRIDAY", saturday: "SATURDAY" };
function weekdayOf(dateStr: string): Weekday {
  return DAY_ENUM[parseAttendanceDate(dateStr).getUTCDay()];
}
const minutesToHhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function requireSession(scope: OrgScope): string {
  if (!scope.academicSessionId) throw new HttpError("INVALID_SESSION", "Select an academic session first");
  return scope.academicSessionId;
}

async function requireSectionInScope(scope: OrgScope, sectionId: string): Promise<{ id: string; branchId: string }> {
  const s = await prisma.section.findFirst({
    where: { id: sectionId, schoolId: scope.schoolId, academicSessionId: requireSession(scope), ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    select: { id: true, branchId: true },
  });
  if (!s) throw new HttpError("NOT_FOUND", "Section not found");
  return s;
}

// ── Lesson options for a date ────────────────────────────────────────────────

/** Real scheduled teaching lessons for a section on a date (+ any open session). */
export async function listPeriodLessons(scope: OrgScope, sectionId: string, dateStr: string): Promise<PeriodLessonDto[]> {
  await requireAttendanceFeature(scope);
  await requireSectionInScope(scope, sectionId);
  const date = parseAttendanceDate(dateStr);
  const weekday = weekdayOf(dateStr);

  const entries = await prisma.timetableEntry.findMany({
    where: { sectionId, weekday: DAY_TO_DB[weekday] as never, period: { type: "TEACHING" } },
    orderBy: [{ period: { order: "asc" } }],
    select: {
      id: true,
      period: { select: { id: true, name: true, startMinutes: true, endMinutes: true } },
      subject: { select: { id: true, code: true, name: true, color: true } },
      staff: { select: { id: true, employeeCode: true, firstName: true, lastName: true, displayName: true } },
    },
  });
  if (entries.length === 0) return [];

  // Any period sessions already opened for these lessons on this date.
  const sessions = await prisma.attendanceSession.findMany({
    where: { type: "PERIOD", date, timetableEntryId: { in: entries.map((e) => e.id) } },
    select: { id: true, status: true, timetableEntryId: true },
  });
  const byEntry = new Map(sessions.map((s) => [s.timetableEntryId, s]));

  return entries.map((e) => {
    const sess = byEntry.get(e.id);
    const staffName = e.staff.displayName?.trim() || `${e.staff.firstName} ${e.staff.lastName ?? ""}`.trim();
    return {
      timetableEntryId: e.id, weekday,
      period: { id: e.period.id, name: e.period.name, startTime: minutesToHhmm(e.period.startMinutes), endTime: minutesToHhmm(e.period.endMinutes) },
      subject: { id: e.subject.id, code: e.subject.code, name: e.subject.name, color: e.subject.color },
      teacher: { id: e.staff.id, employeeCode: e.staff.employeeCode, name: staffName },
      sessionId: sess?.id ?? null, status: sess ? sess.status.toLowerCase() : null,
    };
  });
}

// ── Get-or-create a PERIOD session from a real lesson ────────────────────────

export async function createOrGetPeriodSession(scope: OrgScope, timetableEntryId: string, dateStr: string, actor: { id: string; name: string | null }): Promise<AttendanceSessionViewDto> {
  await requireAttendanceFeature(scope);
  const date = parseAttendanceDate(dateStr);

  // Load the lesson, validated to the caller's scope, with the snapshot data.
  const entry = await prisma.timetableEntry.findFirst({
    where: { id: timetableEntryId, schoolId: scope.schoolId, academicSessionId: requireSession(scope), ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    select: {
      id: true, sectionId: true, branchId: true, weekday: true, staffId: true,
      period: { select: { id: true, name: true, type: true } },
      subject: { select: { id: true, code: true, name: true } },
      staff: { select: { firstName: true, lastName: true, displayName: true } },
    },
  });
  if (!entry) throw new HttpError("TIMETABLE_ENTRY_NOT_FOUND", "Scheduled lesson not found");

  // Weekday of the date MUST match the lesson's weekday (server-derived).
  if (weekdayOf(dateStr) !== (entry.weekday.toLowerCase() as Weekday)) {
    throw new HttpError("VALIDATION_ERROR", `That lesson is scheduled on ${entry.weekday.toLowerCase()}, not the selected date`);
  }
  if (entry.period.type !== "TEACHING") throw new HttpError("INVALID_TIMETABLE_PERIOD", "Attendance cannot be taken for a break/lunch period");

  // Teacher-ownership: a teacher may only open their own lesson (admins broad).
  await assertCanMutatePeriodSession(scope, { type: "PERIOD", staffId: entry.staffId });

  let session = await prisma.attendanceSession.findFirst({ where: { type: "PERIOD", timetableEntryId, date }, select: PERIOD_SESSION_SELECT });
  if (!session) {
    const staffName = entry.staff.displayName?.trim() || `${entry.staff.firstName} ${entry.staff.lastName ?? ""}`.trim();
    try {
      const created = await prisma.$transaction(async (tx) => {
        const row = await tx.attendanceSession.create({
          data: {
            tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: entry.branchId, academicSessionId: requireSession(scope),
            sectionId: entry.sectionId, date, type: "PERIOD", status: "DRAFT",
            timetableEntryId, periodId: entry.period.id, periodName: entry.period.name,
            subjectId: entry.subject.id, subjectCode: entry.subject.code, subjectName: entry.subject.name,
            staffId: entry.staffId, staffName, markedByUserId: actor.id, markedByName: actor.name,
          },
          select: PERIOD_SESSION_SELECT,
        });
        await recordAudit(tx, scope, "ATTENDANCE_SESSION_CREATED", "AttendanceSession", row.id, { type: "PERIOD", timetableEntryId, subjectId: entry.subject.id, periodId: entry.period.id, date: dateStr });
        return row;
      });
      session = created;
    } catch (e) {
      // Concurrent create → partial-unique(PERIOD, timetableEntryId, date) → re-read.
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
      session = await prisma.attendanceSession.findFirst({ where: { type: "PERIOD", timetableEntryId, date }, select: PERIOD_SESSION_SELECT });
    }
  }
  if (!session) throw new HttpError("ATTENDANCE_SESSION_NOT_FOUND", "Attendance session not found");
  return periodSessionView(scope, session);
}
