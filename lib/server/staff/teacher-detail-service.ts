// Teacher detail aggregation (Phase 9J) — one server round-trip over the
// existing real domains for a single Staff member, instead of the page
// juggling several separate fetches (and instead of re-deriving any of this
// from scratch). No new domain data is invented here: every field comes from
// an existing Phase 6A/7/9B/9C/9E service, and a section is omitted (null)
// rather than guessed when the caller lacks that domain's permission.
//
// Callers MUST resolve their own permission flags from the request's
// AuthzContext (see app/api/staff/[staffId]/teacher-detail/route.ts) — this
// function takes them as an explicit argument because the underlying
// per-domain service functions (getTeacherTimetable, listHomework,
// listLessonPlans) do their own scope/ownership checks but NOT permission
// checks; the permission gate normally lives in each domain's own route.
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";
import { getCurrentStaffProfile, getStaff } from "./service";
import { listTeachingAssignmentsForStaff } from "@/lib/server/academics/teaching-assignments-service";
import { getTeacherTimetable } from "@/lib/server/timetable/entries-service";
import { listHomework } from "@/lib/server/homework/service";
import { listLessonPlans } from "@/lib/server/lesson-plans/service";
import { getStaffAttendancePercent } from "@/lib/server/staff-attendance/service";
import { listLeaveRequests } from "@/lib/server/leave/service";
import type { TeacherDetailDto } from "@/lib/api/contracts";

export type TeacherDetailPermissionFlags = {
  timetable: boolean;
  homework: boolean;
  lessonPlans: boolean;
  /** leave.approve — a broad manager. Self-viewing one's own record is allowed regardless. */
  leaveManage: boolean;
  payroll: boolean;
};

/** Trailing 90 days — a reasonable default window; there is no existing "current term" concept for staff attendance. */
function last90DaysRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 90);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

export async function getStaffTeacherDetail(
  scope: OrgScope,
  staffId: string,
  perms: TeacherDetailPermissionFlags,
): Promise<TeacherDetailDto> {
  const staff = await getStaff(scope, staffId);
  const own = await getCurrentStaffProfile(scope);
  const isSelf = own?.id === staffId;

  // No academic session selected yet is a real, honest "nothing to show" state
  // for every session-scoped domain below — never an aggregation-wide failure.
  const skipIfNoSession = <T>(p: Promise<T>): Promise<T | null> =>
    p.catch((e) => {
      if (e instanceof HttpError && e.code === "INVALID_SESSION") return null;
      throw e;
    });

  const [teachingAssignments, timetable, homework, lessonPlans, attendance, leave] = await Promise.all([
    skipIfNoSession(listTeachingAssignmentsForStaff(scope, staffId)).then((r) => r ?? []),
    perms.timetable ? skipIfNoSession(getTeacherTimetable(scope, staffId)) : Promise.resolve(null),
    perms.homework ? skipIfNoSession(listHomework(scope, { staffId, page: 1, pageSize: 5 })) : Promise.resolve(null),
    perms.lessonPlans ? skipIfNoSession(listLessonPlans(scope, { staffId, page: 1, pageSize: 5 })) : Promise.resolve(null),
    getStaffAttendancePercent(scope, staffId, last90DaysRange()).catch((e) => {
      if (e instanceof HttpError && e.code === "FORBIDDEN") return null;
      throw e;
    }),
    isSelf || perms.leaveManage
      ? listLeaveRequests(scope, { staffId })
      : Promise.resolve(null),
  ]);

  return {
    staff,
    teachingAssignments,
    timetable,
    homework: homework ? { items: homework.data, total: homework.meta.total } : null,
    lessonPlans: lessonPlans ? { items: lessonPlans.data, total: lessonPlans.meta.total } : null,
    attendance,
    leave: leave ? { pendingCount: leave.filter((l) => l.status === "pending").length, items: leave.slice(0, 5) } : null,
    payroll: { visible: perms.payroll },
  };
}
