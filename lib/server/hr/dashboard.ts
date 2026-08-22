// HR Core Dashboard (Phase 9P) — DB-derived metrics only. Present/absent/
// late/on-leave/not-marked reuse the canonical Phase 9E
// getStaffAttendanceSummary() formula verbatim (never re-derived). No
// fabricated attrition/retention/engagement/performance/diversity/
// recruitment-pipeline metrics — none of that has real backing.
import { prisma } from "@/lib/db/prisma";
import type { OrgScope } from "@/lib/server/api/scope";
import type { HrDashboardDto } from "@/lib/api/contracts";
import { getStaffAttendanceSummary } from "@/lib/server/staff-attendance/service";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getHrDashboard(scope: OrgScope): Promise<HrDashboardDto> {
  const branchWhere = scope.branchId ? { branchId: scope.branchId } : {};
  const today = todayIso();
  const monthStart = new Date(`${today.slice(0, 7)}-01T00:00:00.000Z`);
  const nextMonthStart = new Date(monthStart);
  nextMonthStart.setUTCMonth(nextMonthStart.getUTCMonth() + 1);

  const [totalActive, teaching, departmentCount, newHires, attendance] = await Promise.all([
    prisma.staff.count({ where: { schoolId: scope.schoolId, ...branchWhere, status: "ACTIVE" } }),
    prisma.staff.count({ where: { schoolId: scope.schoolId, ...branchWhere, status: "ACTIVE", isTeaching: true } }),
    prisma.department.count({ where: { schoolId: scope.schoolId, ...branchWhere, status: "ACTIVE" } }),
    prisma.staff.count({ where: { schoolId: scope.schoolId, ...branchWhere, status: "ACTIVE", joiningDate: { gte: monthStart, lt: nextMonthStart } } }),
    getStaffAttendanceSummary(scope, { date: today }),
  ]);

  return {
    activeStaff: totalActive,
    teachingStaff: teaching,
    nonTeachingStaff: totalActive - teaching,
    departments: departmentCount,
    presentToday: attendance.present,
    absentToday: attendance.absent,
    lateToday: attendance.late,
    onLeaveToday: attendance.onLeave,
    notMarkedToday: attendance.notMarked,
    newHiresThisMonth: newHires,
  };
}
