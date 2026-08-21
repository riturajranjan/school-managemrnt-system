// Transport Dashboard (Phase 9M) — real, DB-derived counts only. No fake
// on-time %/utilization %/fuel cost/GPS uptime — none of that data exists.
import { prisma } from "@/lib/db/prisma";
import type { OrgScope } from "@/lib/server/api/scope";
import type { TransportDashboardDto } from "@/lib/api/contracts";

export async function getTransportDashboard(scope: OrgScope): Promise<TransportDashboardDto> {
  const branchFilter = scope.branchId ? { branchId: scope.branchId } : {};
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);

  const [activeVehicles, activeRoutes, studentsAssigned, tripsToday, tripsInProgress, tripsCompletedToday] = await Promise.all([
    prisma.transportVehicle.count({ where: { schoolId: scope.schoolId, ...branchFilter, status: "ACTIVE" } }),
    prisma.transportRoute.count({ where: { schoolId: scope.schoolId, ...branchFilter, status: "ACTIVE" } }),
    prisma.studentTransportAssignment.count({ where: { schoolId: scope.schoolId, ...branchFilter, status: "ACTIVE" } }),
    prisma.transportTrip.count({ where: { schoolId: scope.schoolId, ...branchFilter, date: today } }),
    prisma.transportTrip.count({ where: { schoolId: scope.schoolId, ...branchFilter, date: today, status: "IN_PROGRESS" } }),
    prisma.transportTrip.count({ where: { schoolId: scope.schoolId, ...branchFilter, date: today, status: "COMPLETED" } }),
  ]);

  return { activeVehicles, activeRoutes, studentsAssigned, tripsToday, tripsInProgress, tripsCompletedToday };
}
