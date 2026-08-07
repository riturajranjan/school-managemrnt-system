import type { Db } from "@/lib/data/store";
import { addMoney, type Money } from "@/lib/finance/money";
import { documentCompliance } from "./document-compliance";
import { fuelInsights } from "./fuel-insights";
import { maintenanceInsights } from "./maintenance-insights";

const ON_TIME_GRACE_MINUTES = 5;

export type RouteUtilizationRow = {
  routeId: string;
  assignedCount: number;
  capacity: number;
  occupancyPercent: number;
};

/** Occupancy is derived from live assignment counts, never a stored counter —
 * same "never cache a number that can drift" rule as vehicle-live-state. */
export function routeUtilization(db: Db): RouteUtilizationRow[] {
  return db.transportRoutes.map((route) => {
    const assignedCount = db.studentTransportAssignments.filter((a) => a.routeId === route.id && a.status === "active").length;
    return { routeId: route.id, assignedCount, capacity: route.maxCapacity, occupancyPercent: route.maxCapacity > 0 ? Math.round((assignedCount / route.maxCapacity) * 100) : 0 };
  });
}

export type TripDelayRow = { tripId: string; routeId: string; delayMinutes: number };

export function tripDelayStats(db: Db, sinceDaysAgo = 30) {
  const cutoff = new Date(Date.now() - sinceDaysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const trips = db.transportTrips.filter((t) => t.date >= cutoff && t.actualStart && (t.status === "completed" || t.status === "delayed" || t.status === "in-progress"));

  const delays: TripDelayRow[] = trips.map((t) => ({
    tripId: t.id,
    routeId: t.routeId,
    delayMinutes: Math.max(0, Math.round((new Date(t.actualStart!).getTime() - new Date(t.plannedStart).getTime()) / 60000)),
  }));

  const onTimeCount = delays.filter((d) => d.delayMinutes <= ON_TIME_GRACE_MINUTES).length;
  const averageDelayMinutes = delays.length > 0 ? Math.round(delays.reduce((sum, d) => sum + d.delayMinutes, 0) / delays.length) : 0;
  const onTimePercent = delays.length > 0 ? Math.round((onTimeCount / delays.length) * 100) : 100;

  const byRoute = new Map<string, TripDelayRow[]>();
  for (const d of delays) byRoute.set(d.routeId, [...(byRoute.get(d.routeId) ?? []), d]);
  const worstRoutes = Array.from(byRoute.entries())
    .map(([routeId, rows]) => ({ routeId, averageDelayMinutes: Math.round(rows.reduce((sum, r) => sum + r.delayMinutes, 0) / rows.length) }))
    .sort((a, b) => b.averageDelayMinutes - a.averageDelayMinutes)
    .slice(0, 5);

  return { tripsConsidered: delays.length, averageDelayMinutes, onTimePercent, worstRoutes };
}

export function costSummary(db: Db) {
  const maintenance = maintenanceInsights(db);
  const fuel = fuelInsights(db);
  const totalCost: Money = addMoney(maintenance.actualCost, fuel.totalCostThisMonth);

  const completedTrips = db.transportTrips.filter((t) => t.status === "completed" && t.distanceKm);
  const totalDistanceKm = completedTrips.reduce((sum, t) => sum + (t.distanceKm ?? 0), 0);
  const costPerKm = totalDistanceKm > 0 ? Math.round(totalCost.minorUnits / totalDistanceKm) / 100 : 0;

  return { maintenanceCost: maintenance.actualCost, fuelCost: fuel.totalCostThisMonth, totalCost, totalDistanceKm, costPerKm };
}

export function complianceSummary(db: Db) {
  const compliance = documentCompliance(db);
  return { expiredCount: compliance.expiredCount, expiringSoonCount: compliance.expiringSoonCount, blockedVehicles: compliance.blockedVehicles.length, blockedDrivers: compliance.blockedDrivers.length };
}

export function transportReportsSummary(db: Db) {
  return {
    utilization: routeUtilization(db),
    delays: tripDelayStats(db),
    costs: costSummary(db),
    compliance: complianceSummary(db),
  };
}

