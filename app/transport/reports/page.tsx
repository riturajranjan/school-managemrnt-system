"use client";

import { BarChart3, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { useTransportRoutes } from "@/lib/hooks/use-transport";
import { formatMoney } from "@/lib/finance/money";
import { useSisStore } from "@/lib/hooks/use-store";
import { costSummary, complianceSummary, routeUtilization, tripDelayStats } from "@/lib/selectors/transport-reports";

export default function TransportReportsPage() {
  const db = useSisStore();
  const routes = useTransportRoutes();

  const utilization = routeUtilization(db);
  const delays = tripDelayStats(db);
  const costs = costSummary(db);
  const compliance = complianceSummary(db);

  function routeName(id: string) {
    return routes.find((r) => r.id === id)?.name ?? id;
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Reports</h1>
        <p className="text-xs text-muted-foreground">Utilization, delays, costs and compliance across the fleet</p>
      </div>

      <section className="flex flex-col gap-sm">
        <h2 className="text-sm font-semibold text-foreground">On-time performance (last 30 days)</h2>
        <div className="grid grid-cols-2 gap-sm sm:grid-cols-3">
          <StatTile label="On-time trips" value={`${delays.onTimePercent}%`} tone={delays.onTimePercent >= 85 ? "success" : delays.onTimePercent >= 60 ? "warning" : "error"} />
          <StatTile label="Average delay" value={`${delays.averageDelayMinutes} min`} tone={delays.averageDelayMinutes <= 5 ? "success" : "warning"} />
          <StatTile label="Trips considered" value={String(delays.tripsConsidered)} tone="neutral" />
        </div>
        {delays.worstRoutes.length > 0 && (
          <div className="rounded-lg border border-border bg-surface p-sm">
            <p className="mb-xs text-xs font-medium text-muted-foreground">Most delayed routes</p>
            <div className="flex flex-wrap gap-xs">
              {delays.worstRoutes.map((r) => (
                <Badge key={r.routeId} tone={r.averageDelayMinutes > 10 ? "error" : "warning"}>
                  {routeName(r.routeId)} · {r.averageDelayMinutes} min
                </Badge>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-sm">
        <h2 className="text-sm font-semibold text-foreground">Route utilization</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-secondary text-xs text-muted-foreground">
              <tr>
                <th className="px-sm py-xs font-medium">Route</th>
                <th className="px-sm py-xs text-right font-medium">Assigned</th>
                <th className="px-sm py-xs text-right font-medium">Capacity</th>
                <th className="px-sm py-xs text-right font-medium">Occupancy</th>
              </tr>
            </thead>
            <tbody>
              {utilization.map((row) => (
                <tr key={row.routeId} className="border-t border-border">
                  <td className="px-sm py-xs text-foreground">{routeName(row.routeId)}</td>
                  <td className="px-sm py-xs text-right text-muted-foreground">{row.assignedCount}</td>
                  <td className="px-sm py-xs text-right text-muted-foreground">{row.capacity}</td>
                  <td className="px-sm py-xs text-right">
                    <Badge tone={row.occupancyPercent >= 90 ? "warning" : row.occupancyPercent >= 40 ? "success" : "neutral"}>{row.occupancyPercent}%</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-sm">
        <h2 className="text-sm font-semibold text-foreground">Costs</h2>
        <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
          <StatTile label="Maintenance (completed)" value={formatMoney(costs.maintenanceCost, { compact: true })} tone="neutral" />
          <StatTile label="Fuel (this month)" value={formatMoney(costs.fuelCost, { compact: true })} tone="neutral" />
          <StatTile label="Total" value={formatMoney(costs.totalCost, { compact: true })} tone="neutral" />
          <StatTile label="Cost per km" value={costs.totalDistanceKm > 0 ? `₹${costs.costPerKm.toFixed(2)}` : "—"} tone="neutral" />
        </div>
      </section>

      <section className="flex flex-col gap-sm">
        <h2 className="text-sm font-semibold text-foreground">Compliance</h2>
        <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
          <StatTile label="Expired documents" value={String(compliance.expiredCount)} tone={compliance.expiredCount > 0 ? "error" : "success"} />
          <StatTile label="Expiring soon" value={String(compliance.expiringSoonCount)} tone={compliance.expiringSoonCount > 0 ? "warning" : "success"} />
          <StatTile label="Vehicles blocked" value={String(compliance.blockedVehicles)} tone={compliance.blockedVehicles > 0 ? "error" : "success"} />
          <StatTile label="Drivers blocked" value={String(compliance.blockedDrivers)} tone={compliance.blockedDrivers > 0 ? "error" : "success"} />
        </div>
        {(compliance.blockedVehicles > 0 || compliance.blockedDrivers > 0) && (
          <div className="flex items-start gap-xs rounded-lg border border-error/30 bg-error/8 p-sm text-sm text-error">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <span>Review the documents workspace before assigning blocked vehicles or drivers to a live route.</span>
          </div>
        )}
      </section>

      {utilization.length === 0 && (
        <div className="flex flex-col items-center gap-xs rounded-lg border border-dashed border-border p-lg text-center text-muted-foreground">
          <BarChart3 className="size-6" />
          <p className="text-sm">No route data available yet.</p>
        </div>
      )}
    </div>
  );
}
