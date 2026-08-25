"use client";

// Real PostgreSQL/API cutover (Phase 9H). The mock's Finance Pulse
// gauge/payroll-exceptions/tax-withheld tile are dropped — no real
// "finance pulse" score or statutory tax policy exists (see the schema doc
// comment). Every KPI here reads real, finalized/paid PayrollRun data.
import { CalendarClock, HandCoins, Layers, Users } from "lucide-react";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { usePayrollDashboard } from "@/lib/hooks/api/use-payroll-api";
import { roleLabels } from "@/lib/permissions/roles";
import { formatCurrency } from "@/lib/utils";

export default function PayrollDashboardPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data } = usePayrollDashboard();
  if (!capabilitiesLoading && !hasServerPermission("payroll.view")) return <PermissionDenied action="view the payroll module" role={roleLabels[role]} backHref="/payroll" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Payroll dashboard</h1>
        <p className="text-xs text-muted-foreground">Current period, active structures and recent runs</p>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Active structures" value={String(data?.activeStructures ?? "—")} icon={Users} tone="neutral" />
        <StatTile label="Current period" value={data?.currentPeriod?.period ?? "—"} icon={CalendarClock} tone="neutral" />
        <StatTile label="Current period net" value={formatCurrency(data?.currentRunNet ?? 0)} icon={HandCoins} tone="success" />
        <StatTile label="Staff without assignment" value={String(data?.staffWithoutAssignment ?? "—")} icon={Layers} tone={data && data.staffWithoutAssignment > 0 ? "warning" : "success"} />
      </div>

      <div className="surface-3d rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Year to date</h2>
        <div className="grid grid-cols-2 gap-sm text-sm sm:grid-cols-2">
          <div className="rounded-md border border-border p-sm">
            <p className="text-xs text-muted-foreground">Gross</p>
            <p className="text-base font-semibold text-foreground">{formatCurrency(data?.yearToDateGross ?? 0)}</p>
          </div>
          <div className="rounded-md border border-border p-sm">
            <p className="text-xs text-muted-foreground">Net</p>
            <p className="text-base font-semibold text-foreground">{formatCurrency(data?.yearToDateNet ?? 0)}</p>
          </div>
        </div>

        <h2 className="mb-sm mt-md text-sm font-semibold text-foreground">Recent runs</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="p-xs text-left">Period</th>
                <th className="p-xs text-left">Status</th>
                <th className="p-xs text-right">Gross</th>
                <th className="p-xs text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {data?.recentRuns.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="p-xs text-foreground">{r.period}</td>
                  <td className="p-xs capitalize text-muted-foreground">{r.status}</td>
                  <td className="p-xs text-right text-muted-foreground">{formatCurrency(r.totalGross)}</td>
                  <td className="p-xs text-right font-medium text-foreground">{formatCurrency(r.totalNet)}</td>
                </tr>
              ))}
              {(!data || data.recentRuns.length === 0) && (
                <tr>
                  <td colSpan={4} className="p-md text-center text-muted-foreground">
                    No payroll runs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
