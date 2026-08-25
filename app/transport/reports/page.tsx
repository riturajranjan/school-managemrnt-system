"use client";

import { BarChart3, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useTransportReports } from "@/lib/hooks/api/use-transport-api";
import { roleLabels } from "@/lib/permissions/roles";

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function TransportReportsPage() {
  const { data, loading, error, reload } = useTransportReports();
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();

  if (!capabilitiesLoading && !hasServerPermission("transport.view")) {
    return <PermissionDenied action="view transport reports" role={roleLabels[role]} backHref="/transport" />;
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Reports</h1>
        <p className="text-xs text-muted-foreground">Utilization, costs and document compliance — every figure is real, derived at read time</p>
      </div>

      {error ? (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load reports: {error}
          <Button variant="outline" size="sm" className="ml-sm" onClick={reload}>
            Retry
          </Button>
        </div>
      ) : loading && !data ? (
        <div className="rounded-lg border border-border bg-surface p-2xl text-center text-sm text-muted-foreground">Loading reports…</div>
      ) : data ? (
        <>
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
                  {data.routeUtilization.map((row) => (
                    <tr key={row.routeId} className="border-t border-border">
                      <td className="px-sm py-xs text-foreground">{row.routeName}</td>
                      <td className="px-sm py-xs text-right text-muted-foreground">{row.assignedCount}</td>
                      <td className="px-sm py-xs text-right text-muted-foreground">{row.capacity ?? "—"}</td>
                      <td className="px-sm py-xs text-right">{row.occupancyPercent === null ? <span className="text-muted-foreground">—</span> : <Badge tone={row.occupancyPercent >= 90 ? "warning" : row.occupancyPercent >= 40 ? "success" : "neutral"}>{row.occupancyPercent}%</Badge>}</td>
                    </tr>
                  ))}
                  {data.routeUtilization.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-sm py-md text-center text-muted-foreground">
                        No active routes yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="flex flex-col gap-sm">
            <h2 className="text-sm font-semibold text-foreground">Costs</h2>
            <div className="grid grid-cols-2 gap-sm sm:grid-cols-3">
              <StatTile label="Maintenance (completed this month)" value={rupees(data.maintenanceCostCompleted)} tone="neutral" />
              <StatTile label="Fuel (this month)" value={rupees(data.fuelCostThisMonth)} tone="neutral" />
              <StatTile label="Total" value={rupees(data.maintenanceCostCompleted + data.fuelCostThisMonth)} tone="neutral" />
            </div>
          </section>

          <section className="flex flex-col gap-sm">
            <h2 className="text-sm font-semibold text-foreground">Compliance</h2>
            <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
              <StatTile label="Expired documents" value={String(data.compliance.expiredCount)} tone={data.compliance.expiredCount > 0 ? "error" : "success"} />
              <StatTile label="Expiring soon" value={String(data.compliance.expiringSoonCount)} tone={data.compliance.expiringSoonCount > 0 ? "warning" : "success"} />
              <StatTile label="Vehicles blocked" value={String(data.compliance.blockedVehicleCount)} tone={data.compliance.blockedVehicleCount > 0 ? "error" : "success"} />
              <StatTile label="Drivers blocked" value={String(data.compliance.blockedDriverCount)} tone={data.compliance.blockedDriverCount > 0 ? "error" : "success"} />
            </div>
            {(data.compliance.blockedVehicleCount > 0 || data.compliance.blockedDriverCount > 0) && (
              <div className="flex items-start gap-xs rounded-lg border border-error/30 bg-error/8 p-sm text-sm text-error">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                <span>Review the documents workspace before assigning blocked vehicles or drivers to a live route.</span>
              </div>
            )}
          </section>

          {data.routeUtilization.length === 0 && (
            <div className="flex flex-col items-center gap-xs rounded-lg border border-dashed border-border p-lg text-center text-muted-foreground">
              <BarChart3 className="size-6" />
              <p className="text-sm">No route data available yet.</p>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
