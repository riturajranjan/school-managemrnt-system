// Academics hub aggregation. One server-side composition layer, mirroring the
// Phase 9A Main Dashboard's getDashboardSummary — every figure is either a
// real count or a DTO reused verbatim from its owning canonical service.
// Never recomputes another service's formula (curriculum %, attendance %,
// etc. all come straight from their real service).
import type { OrgScope } from "@/lib/server/api/scope";
import type { AcademicsDashboardDto } from "@/lib/api/contracts";
import { serverToday } from "@/lib/server/attendance/service";
import { getDashboard as getAttendanceDashboard } from "@/lib/server/attendance/reports";
import { getCurriculumInsights } from "@/lib/server/curriculum/service";
import { listLessonPlans } from "@/lib/server/lesson-plans/service";
import { listHomework } from "@/lib/server/homework/service";
import { listStaff } from "@/lib/server/staff/service";
import { getStaffAttendanceRoster } from "@/lib/server/staff-attendance/service";
import { listClasses } from "@/lib/server/academics/service";
import { listCalendarEvents } from "@/lib/server/calendar/service";

function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function getAcademicsDashboard(scope: OrgScope): Promise<AcademicsDashboardDto> {
  const today = serverToday();
  const yesterday = addDaysStr(today, -1);
  const in30Days = addDaysStr(today, 30);

  const [
    classes,
    teachingStaff,
    roster,
    attendance,
    curriculum,
    homeworkDraft,
    homeworkPublished,
    homeworkOverdueOpen,
    lessonPlansDraft,
    lessonPlansSubmitted,
    lessonPlansApproved,
    upcomingEvents,
  ] = await Promise.all([
    listClasses(scope, scope.academicSessionId ?? undefined),
    listStaff(scope, { teaching: true, status: "active" }),
    getStaffAttendanceRoster(scope, { date: today }),
    getAttendanceDashboard(scope),
    getCurriculumInsights(scope),
    listHomework(scope, { status: "draft", pageSize: 1 }).then((r) => r.meta.total),
    listHomework(scope, { status: "published", pageSize: 1 }).then((r) => r.meta.total),
    listHomework(scope, { status: "published", dueTo: yesterday, pageSize: 1 }).then((r) => r.meta.total),
    listLessonPlans(scope, { status: "draft", pageSize: 1 }).then((r) => r.meta.total),
    listLessonPlans(scope, { status: "submitted", pageSize: 1 }).then((r) => r.meta.total),
    listLessonPlans(scope, { status: "approved", pageSize: 1 }).then((r) => r.meta.total),
    listCalendarEvents(scope, { from: today, to: in30Days }),
  ]);

  const teachingStaffIds = new Set(teachingStaff.map((s) => s.id));
  const teachingStaffOnLeaveToday = roster.filter((r) => teachingStaffIds.has(r.staffId) && r.status === "on-leave").length;

  return {
    activeClasses: classes.filter((c) => c.status === "active").length,
    teachingStaffCount: teachingStaff.length,
    teachingStaffOnLeaveToday,
    attendance,
    curriculum,
    homework: { draftCount: homeworkDraft, publishedCount: homeworkPublished, overdueOpenCount: homeworkOverdueOpen },
    lessonPlans: { draftCount: lessonPlansDraft, pendingApprovalCount: lessonPlansSubmitted, approvedCount: lessonPlansApproved },
    upcomingEvents: [...upcomingEvents].sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0)).slice(0, 5),
  };
}
