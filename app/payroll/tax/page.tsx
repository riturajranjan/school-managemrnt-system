"use client";

import Papa from "papaparse";
import { Download, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { formatMoney, sumMoney } from "@/lib/finance/money";
import { payrollCostTrend, taxWithheldTrend } from "@/lib/selectors/finance-reports";
import { downloadTextFile } from "@/lib/utils";

export default function PayrollTaxPage() {
  const db = useSisStore();
  const { can } = usePermissions();
  const canExport = can("payroll.view");

  const taxTrend = taxWithheldTrend(db);
  const costTrend = payrollCostTrend(db);
  const totalTaxWithheld = sumMoney(
    taxTrend.map((t) => t.taxWithheld),
    "INR",
  );

  function exportCsv() {
    downloadTextFile("payroll-tax-summary.csv", Papa.unparse(taxTrend.map((t) => ({ Period: t.period, "Employees taxed": t.employeeCount, "Tax withheld": formatMoney(t.taxWithheld) }))));
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Tax summary</h1>
          <p className="text-xs text-muted-foreground">Statutory deductions withheld through payroll, by period</p>
        </div>
        {canExport && (
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="size-3.5" />
            Export CSV
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-3">
        <StatTile label="Total tax withheld" value={formatMoney(totalTaxWithheld, { compact: true })} icon={Percent} tone="neutral" />
        <StatTile label="Periods with payroll" value={String(costTrend.length)} tone="neutral" />
        <StatTile label="Latest period cost" value={costTrend.length > 0 ? formatMoney(costTrend[costTrend.length - 1].totalGross, { compact: true }) : "—"} tone="neutral" />
      </div>

      <div className="surface-3d rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Tax withheld by period</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[320px] text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="p-xs text-left">Period</th>
                <th className="p-xs text-right">Employees taxed</th>
                <th className="p-xs text-right">Tax withheld</th>
              </tr>
            </thead>
            <tbody>
              {taxTrend.map((row) => (
                <tr key={row.period} className="border-t border-border">
                  <td className="p-xs text-foreground">{row.period}</td>
                  <td className="p-xs text-right text-muted-foreground">{row.employeeCount}</td>
                  <td className="p-xs text-right font-medium text-foreground">{formatMoney(row.taxWithheld)}</td>
                </tr>
              ))}
              {taxTrend.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-md text-center text-muted-foreground">
                    No payroll tax data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="surface-3d rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Payroll cost trend</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="p-xs text-left">Period</th>
                <th className="p-xs text-right">Employees</th>
                <th className="p-xs text-right">Gross</th>
                <th className="p-xs text-right">Deductions</th>
                <th className="p-xs text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {costTrend.map((row) => (
                <tr key={row.period} className="border-t border-border">
                  <td className="p-xs text-foreground">{row.period}</td>
                  <td className="p-xs text-right text-muted-foreground">{row.employeeCount}</td>
                  <td className="p-xs text-right text-foreground">{formatMoney(row.totalGross)}</td>
                  <td className="p-xs text-right text-foreground">{formatMoney(row.totalDeductions)}</td>
                  <td className="p-xs text-right font-medium text-foreground">{formatMoney(row.totalNet)}</td>
                </tr>
              ))}
              {costTrend.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-md text-center text-muted-foreground">
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
