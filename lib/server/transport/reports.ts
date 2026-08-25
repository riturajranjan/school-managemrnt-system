// Transport Reports — pure aggregation over real data only. No fabricated
// on-time %/delay minutes (no scheduled-vs-actual trip timing data exists to
// compare against) and no cost-per-km (no reliable per-vehicle distance
// series exists yet) — dropped rather than invented. Route utilization,
// maintenance/fuel cost totals and document compliance are all real.
import { prisma } from "@/lib/db/prisma";
import type { OrgScope } from "@/lib/server/api/scope";
import type { TransportReportsDto } from "@/lib/api/contracts";
import { getMaintenanceInsights } from "./maintenance";
import { getFuelInsights } from "./fuel";
import { getComplianceSummary } from "./documents";

export async function getTransportReports(scope: OrgScope): Promise<TransportReportsDto> {
  const branchFilter = scope.branchId ? { branchId: scope.branchId } : {};

  const [routes, assignmentCounts, maintenance, fuel, compliance] = await Promise.all([
    prisma.transportRoute.findMany({ where: { schoolId: scope.schoolId, ...branchFilter, status: "ACTIVE" }, select: { id: true, name: true, capacity: true } }),
    prisma.studentTransportAssignment.groupBy({ by: ["routeId"], where: { schoolId: scope.schoolId, ...branchFilter, status: "ACTIVE" }, _count: { _all: true } }),
    getMaintenanceInsights(scope),
    getFuelInsights(scope),
    getComplianceSummary(scope),
  ]);

  const assignedByRoute = new Map(assignmentCounts.map((a) => [a.routeId, a._count._all]));
  const routeUtilization = routes.map((r) => {
    const assignedCount = assignedByRoute.get(r.id) ?? 0;
    return { routeId: r.id, routeName: r.name, assignedCount, capacity: r.capacity, occupancyPercent: r.capacity && r.capacity > 0 ? Math.round((assignedCount / r.capacity) * 100) : null };
  });

  return {
    routeUtilization,
    maintenanceCostCompleted: maintenance.completedCostThisMonth,
    fuelCostThisMonth: fuel.costThisMonth,
    compliance,
  };
}
