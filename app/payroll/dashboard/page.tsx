"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, HandCoins, Percent, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { FinancePulseGauge } from "@/components/finance/finance-pulse-gauge";
import { useSisStore } from "@/lib/hooks/use-store";
import { formatMoney, sumMoney } from "@/lib/finance/money";
import { financeExceptions } from "@/lib/selectors/finance-brief";
import { computeFinancePulse } from "@/lib/selectors/finance-pulse";
import { payrollCostTrend, taxWithheldTrend } from "@/lib/selectors/finance-reports";

const severityTone = { high: "error", medium: "warning", low: "neutral" } as const;
const payrollExceptionIds = new Set(["payroll-exceptions"]);

export default function PayrollDashboardPage() {
  const db = useSisStore();
  const pulse = computeFinancePulse(db);
  const exceptions = financeExceptions(db).filter((e) => payrollExceptionIds.has(e.id));
  const costTrend = payrollCostTrend(db);
  const taxTrend = taxWithheldTrend(db);
  const lastRun = costTrend[costTrend.length - 1];
  const activeStructures = db.salaryStructures.filter((s) => s.status === "active").length;
  const totalTaxWithheld = sumMoney(
    taxTrend.map((t) => t.taxWithheld),
    "INR",
  );

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Payroll dashboard</h1>
        <p className="text-xs text-muted-foreground">Latest run cost, active structures and payroll exceptions</p>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Active structures" value={String(activeStructures)} icon={Users} tone="neutral" />
        <StatTile label="Last run period" value={lastRun ? lastRun.period : "—"} icon={CalendarClock} tone="neutral" />
        <StatTile label="Last run net pay" value={lastRun ? formatMoney(lastRun.totalNet, { compact: true }) : "—"} icon={HandCoins} tone="success" />
        <StatTile label="Total tax withheld" value={formatMoney(totalTaxWithheld, { compact: true })} icon={Percent} tone="neutral" />
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-3">
        <div className="surface-3d flex flex-col items-center rounded-lg border border-border bg-surface p-md lg:col-span-1">
          <h2 className="mb-sm self-start text-sm font-semibold text-foreground">Finance Pulse</h2>
          <FinancePulseGauge score={pulse.score} components={pulse.components} />
        </div>

        <div className="surface-3d rounded-lg border border-border bg-surface p-md lg:col-span-2">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Payroll exceptions</h2>
          {exceptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payroll exceptions — every active run is clear to approve.</p>
          ) : (
            <ul className="flex flex-col gap-xs">
              {exceptions.map((exception) => (
                <li key={exception.id}>
                  <Link href={exception.href} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm transition-colors hover:border-primary/40">
                    <div className="flex min-w-0 items-center gap-2">
                      <AlertTriangle className={`size-4 shrink-0 ${exception.severity === "high" ? "text-error" : exception.severity === "medium" ? "text-warning" : "text-muted-foreground"}`} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{exception.label}</p>
                        <p className="truncate text-xs text-muted-foreground">{exception.description}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Badge tone={severityTone[exception.severity]}>{exception.severity}</Badge>
                      <ArrowRight className="size-3.5 text-muted-foreground" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <h2 className="mb-sm mt-md text-sm font-semibold text-foreground">Recent payroll cost</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="p-xs text-left">Period</th>
                  <th className="p-xs text-right">Gross</th>
                  <th className="p-xs text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {costTrend.slice(-6).map((row) => (
                  <tr key={row.period} className="border-t border-border">
                    <td className="p-xs text-foreground">{row.period}</td>
                    <td className="p-xs text-right text-muted-foreground">{formatMoney(row.totalGross)}</td>
                    <td className="p-xs text-right font-medium text-foreground">{formatMoney(row.totalNet)}</td>
                  </tr>
                ))}
                {costTrend.length === 0 && (
                  <tr>
                    <td colSpan={3} className="p-md text-center text-muted-foreground">
                      No payroll runs yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
