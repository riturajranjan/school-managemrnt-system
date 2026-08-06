"use client";

import Papa from "papaparse";
import { Coins, Download, Gift, PiggyBank, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { formatMoney } from "@/lib/finance/money";
import { collectionSummaryByMethod, totalCollected, totalOutstanding, waiverSummary } from "@/lib/selectors/finance-reports";
import { paymentMethodLabels } from "@/lib/types/payments";
import { downloadTextFile } from "@/lib/utils";

export default function FeeReportsPage() {
  const db = useSisStore();
  const { can } = usePermissions();
  const canExport = can("fees.viewReports") || can("fees.manageStructures");

  const collected = totalCollected(db);
  const outstanding = totalOutstanding(db);
  const byMethod = collectionSummaryByMethod(db);
  const waivers = waiverSummary(db);

  function exportCsv() {
    const csv = Papa.unparse(byMethod.map((m) => ({ Method: paymentMethodLabels[m.method], "Transactions": m.count, "Total collected": formatMoney(m.total) })));
    downloadTextFile("fee-collection-by-method.csv", csv);
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Fee reports</h1>
          <p className="text-xs text-muted-foreground">Collection, dues and waiver summaries</p>
        </div>
        {canExport && (
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="size-3.5" />
            Export CSV
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Total collected" value={formatMoney(collected, { compact: true })} icon={Wallet} tone="success" />
        <StatTile label="Total outstanding" value={formatMoney(outstanding, { compact: true })} icon={Coins} tone={outstanding.minorUnits > 0 ? "warning" : "success"} />
        <StatTile label="Discounts + concessions" value={formatMoney({ minorUnits: waivers.discounts.minorUnits + waivers.concessions.minorUnits, currency: "INR" }, { compact: true })} icon={Gift} tone="neutral" />
        <StatTile label="Scholarships" value={formatMoney(waivers.scholarships, { compact: true })} icon={PiggyBank} tone="neutral" />
      </div>

      <div className="surface-3d rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Collection by payment method</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="p-xs text-left">Method</th>
                <th className="p-xs text-right">Transactions</th>
                <th className="p-xs text-right">Total collected</th>
              </tr>
            </thead>
            <tbody>
              {byMethod.map((row) => (
                <tr key={row.method} className="border-t border-border">
                  <td className="p-xs text-foreground">{paymentMethodLabels[row.method]}</td>
                  <td className="p-xs text-right text-muted-foreground">{row.count}</td>
                  <td className="p-xs text-right font-medium text-foreground">{formatMoney(row.total)}</td>
                </tr>
              ))}
              {byMethod.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-md text-center text-muted-foreground">
                    No collections recorded yet.
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
