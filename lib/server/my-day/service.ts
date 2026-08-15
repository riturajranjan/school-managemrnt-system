// My Day (Phase 9A/9B) — the teacher's real daily operating view. User → real
// Staff.userId → today's real TimetableEntry rows, each enriched with its real
// PERIOD AttendanceSession state; real pending ExamMarkSheet actions (via real
// TeachingAssignment ownership); real upcoming exam papers; real Homework
// (Phase 9B). Lesson Plans stays explicitly `{ available: false }` — that
// backend doesn't exist yet (Phase 9C). No fabricated counts anywhere in this
// file.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";
import type { MyDayDto, MyDayMarksActionDto, MyDayTimetableEntryDto, Weekday } from "@/lib/api/contracts";
import { serverToday } from "@/lib/server/attendance/service";
import { weekdayOf } from "@/lib/server/attendance/period-service";
import { getCurrentStaffProfile } from "@/lib/server/staff/service";
import { getTeacherEntriesForWeekday } from "@/lib/server/timetable/entries-service";
import { listMarksSummary } from "@/lib/server/exams/marks-service";
import { listUpcomingExams } from "@/lib/server/exams/upcoming-service";
import { getMyDayHomeworkSummary } from "@/lib/server/homework/service";

function requireSession(scope: OrgScope): string {
  if (!scope.academicSessionId) throw new HttpError("INVALID_SESSION", "Select an academic session first");
  return scope.academicSessionId;
}

const SESSION_STATUS_TO_UI: Record<string, "draft" | "submitted" | "locked"> = { DRAFT: "draft", SUBMITTED: "submitted", LOCKED: "locked" };

/**
 * Real scheduled lessons for a staff member on one weekday, each enriched
 * with its real PERIOD AttendanceSession state. Shared by My Day and the Main
 * Dashboard's "Today's Timetable" widget — one query path, one truth, so the
 * two surfaces can never silently disagree about today's schedule.
 */
export async function getEnrichedDayTimetable(scope: OrgScope, staffId: string, weekday: Weekday): Promise<MyDayTimetableEntryDto[]> {
  const lessons = await getTeacherEntriesForWeekday(scope, staffId, weekday);
  if (lessons.length === 0) return [];

  const today = new Date(`${serverToday()}T00:00:00.000Z`);
  const sessions = await prisma.attendanceSession.findMany({
    where: { type: "PERIOD", date: today, timetableEntryId: { in: lessons.map((l) => l.timetableEntryId) } },
    select: { id: true, status: true, timetableEntryId: true },
  });
  const byEntry = new Map(sessions.map((s) => [s.timetableEntryId, s]));

  return lessons.map((l) => {
    const sess = byEntry.get(l.timetableEntryId);
    return {
      timetableEntryId: l.timetableEntryId, weekday: l.weekday, period: l.period, section: l.section, subject: l.subject,
      attendance: { sessionId: sess?.id ?? null, status: sess ? SESSION_STATUS_TO_UI[sess.status] : "not_marked" },
    };
  });
}

export async function getMyDay(scope: OrgScope): Promise<MyDayDto> {
  requireSession(scope);
  const today = serverToday();
  const weekday = weekdayOf(today);
  const staff = await getCurrentStaffProfile(scope);

  // No real teaching Staff profile — an honest "not applicable" state, never
  // a fabricated teacher identity or borrowed data from someone else's day.
  if (!staff || !staff.isTeaching) {
    return {
      date: today, weekday, staff,
      timetable: [],
      attendance: { pendingCount: 0, completedCount: 0 },
      marks: { pendingCount: 0, actions: [] },
      upcomingExams: [],
      homework: { draftCount: 0, dueTodayOrOverdueCount: 0, items: [] },
      lessonPlans: { available: false },
    };
  }

  const [timetable, marksSummary, upcomingExams, assignments, homework] = await Promise.all([
    getEnrichedDayTimetable(scope, staff.id, weekday),
    listMarksSummary(scope),
    listUpcomingExams(scope, { staffId: staff.id }),
    prisma.teachingAssignment.findMany({ where: { staffId: staff.id, schoolId: scope.schoolId }, select: { sectionId: true, subjectId: true } }),
    getMyDayHomeworkSummary(scope, staff.id, today),
  ]);

  const owned = new Set(assignments.map((a) => `${a.sectionId}::${a.subjectId}`));
  const marksActions: MyDayMarksActionDto[] = marksSummary
    .filter((m) => owned.has(`${m.section.id}::${m.subject.id}`) && m.sheetStatus !== "verified")
    .map((m) => ({ entryId: m.entryId, examId: m.examId, examName: m.examName, examDate: m.examDate, section: m.section, subject: m.subject, sheetStatus: m.sheetStatus, totalStudents: m.totalStudents, enteredCount: m.enteredCount }));

  const pendingAttendance = timetable.filter((t) => t.attendance.status === "not_marked" || t.attendance.status === "draft").length;

  return {
    date: today, weekday, staff,
    timetable,
    attendance: { pendingCount: pendingAttendance, completedCount: timetable.length - pendingAttendance },
    marks: { pendingCount: marksActions.length, actions: marksActions },
    upcomingExams,
    homework,
    lessonPlans: { available: false },
  };
}
