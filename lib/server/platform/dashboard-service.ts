// Platform (Super Admin) dashboard summary service (Phase SA-4J). Real school
// lifecycle counts derived directly from School rows — no mock tenant status.
//
// "New this month" = School.createdAt >= the start of the current CALENDAR month
// (UTC), using server time. `now` is injectable so the month boundary is testable
// without wall-clock flakiness.
import { prisma } from "@/lib/db/prisma";
import { schoolStatusFromUi } from "@/lib/server/api/enums";

export type DashboardSummary = {
  totalSchools: number;
  activeSchools: number;
  setupPendingSchools: number;
  suspendedSchools: number;
  newSchoolsThisMonth: number;
};

function startOfMonthUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export async function getDashboardSummary(now: Date = new Date()): Promise<DashboardSummary> {
  const [byStatus, total, newSchoolsThisMonth] = await Promise.all([
    prisma.school.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.school.count(),
    prisma.school.count({ where: { createdAt: { gte: startOfMonthUtc(now) } } }),
  ]);

  const countFor = (uiStatus: string): number => byStatus.find((r) => r.status === schoolStatusFromUi[uiStatus])?._count._all ?? 0;

  return {
    totalSchools: total,
    activeSchools: countFor("active"),
    setupPendingSchools: countFor("setup-pending"),
    suspendedSchools: countFor("suspended"),
    newSchoolsThisMonth,
  };
}
