// HR Core Dashboard (Phase 9P, extended Sub-batch 4) — DB-derived metrics
// only. Present/absent/late/on-leave/not-marked reuse the canonical
// Phase 9E getStaffAttendanceSummary() formula verbatim (never re-derived).
// Recruitment/onboarding metrics (Sub-batch 4) are real, school-wide
// aggregates over JobOpening/JobApplicant/EmployeeOnboarding — no fabricated
// attrition/retention/engagement/diversity metrics exist anywhere here.
import { prisma } from "@/lib/db/prisma";
import type { OrgScope } from "@/lib/server/api/scope";
import type { HrDashboardDto, JobApplicantStageDto } from "@/lib/api/contracts";
import { getStaffAttendanceSummary } from "@/lib/server/staff-attendance/service";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const STAGE_TO_DTO: Record<string, JobApplicantStageDto> = {
  APPLIED: "applied", SCREENING: "screening", INTERVIEW: "interview", SELECTED: "selected", HIRED: "hired", REJECTED: "rejected", WITHDRAWN: "withdrawn",
};
const EMPTY_STAGE_COUNTS: Record<JobApplicantStageDto, number> = {
  applied: 0, screening: 0, interview: 0, selected: 0, hired: 0, rejected: 0, withdrawn: 0,
};

export async function getHrDashboard(scope: OrgScope): Promise<HrDashboardDto> {
  const branchWhere = scope.branchId ? { branchId: scope.branchId } : {};
  const today = todayIso();
  const monthStart = new Date(`${today.slice(0, 7)}-01T00:00:00.000Z`);
  const nextMonthStart = new Date(monthStart);
  nextMonthStart.setUTCMonth(nextMonthStart.getUTCMonth() + 1);

  const [totalActive, teaching, departmentCount, newHires, attendance, openJobOpenings, applicantStages, onboardings] = await Promise.all([
    prisma.staff.count({ where: { schoolId: scope.schoolId, ...branchWhere, status: "ACTIVE" } }),
    prisma.staff.count({ where: { schoolId: scope.schoolId, ...branchWhere, status: "ACTIVE", isTeaching: true } }),
    prisma.department.count({ where: { schoolId: scope.schoolId, ...branchWhere, status: "ACTIVE" } }),
    prisma.staff.count({ where: { schoolId: scope.schoolId, ...branchWhere, status: "ACTIVE", joiningDate: { gte: monthStart, lt: nextMonthStart } } }),
    getStaffAttendanceSummary(scope, { date: today }),
    prisma.jobOpening.count({ where: { schoolId: scope.schoolId, ...branchWhere, status: "OPEN" } }),
    prisma.jobApplicant.groupBy({ by: ["stage"], where: { schoolId: scope.schoolId, ...branchWhere }, _count: { _all: true } }),
    prisma.employeeOnboarding.findMany({
      where: { schoolId: scope.schoolId, ...branchWhere, status: { in: ["NOT_STARTED", "IN_PROGRESS"] } },
      select: { tasks: { select: { status: true } } },
    }),
  ]);

  const applicantsByStage = { ...EMPTY_STAGE_COUNTS };
  for (const row of applicantStages) {
    const dto = STAGE_TO_DTO[row.stage];
    if (dto) applicantsByStage[dto] = row._count._all;
  }

  const progressValues = onboardings.map((o) => (o.tasks.length === 0 ? 0 : (o.tasks.filter((t) => t.status === "COMPLETED").length / o.tasks.length) * 100));
  const avgOnboardingProgress = progressValues.length === 0 ? null : Math.round(progressValues.reduce((s, p) => s + p, 0) / progressValues.length);

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
    openJobOpenings,
    applicantsByStage,
    activeOnboardings: onboardings.length,
    avgOnboardingProgress,
  };
}
