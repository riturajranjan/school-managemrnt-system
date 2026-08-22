// Activities Dashboard (Phase 9U) — DB-derived counts only. No fabricated
// engagement score, participation quality, performance, or attendance %.
import { prisma } from "@/lib/db/prisma";
import type { OrgScope } from "@/lib/server/api/scope";
import type { ActivityDashboardDto } from "@/lib/api/contracts";

export async function getActivityDashboard(scope: OrgScope): Promise<ActivityDashboardDto> {
  const branchWhere = scope.branchId ? { branchId: scope.branchId } : {};
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startOfNextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [activeActivities, activeMemberships, upcomingEvents, eventsThisMonth, distinctCoordinators, participationCount] = await Promise.all([
    prisma.activity.count({ where: { schoolId: scope.schoolId, ...branchWhere, status: "ACTIVE" } }),
    prisma.activityStudentMembership.count({ where: { schoolId: scope.schoolId, ...branchWhere, status: "ACTIVE" } }),
    prisma.activityEvent.count({ where: { schoolId: scope.schoolId, ...branchWhere, status: "PUBLISHED", startAt: { gte: now } } }),
    prisma.activityEvent.count({ where: { schoolId: scope.schoolId, ...branchWhere, startAt: { gte: startOfMonth, lt: startOfNextMonth } } }),
    prisma.activityStaffAssignment.findMany({ where: { schoolId: scope.schoolId, ...branchWhere, status: "ACTIVE" }, select: { staffId: true }, distinct: ["staffId"] }),
    prisma.activityEventParticipant.count({ where: { schoolId: scope.schoolId, ...branchWhere, status: { in: ["REGISTERED", "ATTENDED"] } } }),
  ]);

  return { activeActivities, activeMemberships, upcomingEvents, eventsThisMonth, coordinatorCount: distinctCoordinators.length, participationCount };
}
