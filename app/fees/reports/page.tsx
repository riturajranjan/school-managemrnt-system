"use client";

// Real PostgreSQL/API cutover (Phase 9F) — every total here reuses the same
// canonical DB-derived reports (GET /api/fees/reports/*) that Collection and
// Dues read — no separate frontend formula.
import Papa from "papaparse";
import { Coins, Download, Gift, PiggyBank, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useFeeAdjustmentReport, useFeeCollectionReport, useFeeOutstandingReport, useFeeRefundReport } from "@/lib/hooks/api/use-fees-api";
import { downloadTextFile, formatCurrency } from "@/lib/utils";

export default function FeeReportsPage() {
  const { can } = usePermissions();
  const { data: collection } = useFeeCollectionReport();
  const { data: outstanding } = useFeeOutstandingReport();
  const { data: discounts } = useFeeAdjustmentReport("discount");
  const { data: scholarships } = useFeeAdjustmentReport("scholarship");
  const { data: refunds } = useFeeRefundReport();

  if (!can("fees.view")) {
    return <p className="py-2xl text-center text-sm text-muted-foreground">You don&apos;t have permission to view fee reports.</p>;
  }

  function exportCollectionCsv() {
    if (!collection) return;
    const csv = Papa.unparse(collection.byMethod.map((m) => ({ Method: m.method, Amount: formatCurrency(m.amount), Count: m.count })));
    downloadTextFile("fee-collection-by-method.csv", csv);
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Fee reports</h1>
          <p className="text-xs text-muted-foreground">Collection, dues, adjustments and refunds — all DB-derived</p>
        </div>
        <Button size="sm" variant="outline" onClick={exportCollectionCsv} disabled={!collection}>
          <Download className="size-3.5" />
          Export
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Total collected" value={collection ? formatCurrency(collection.totalCollected) : "—"} icon={Wallet} tone="success" />
        <StatTile label="Total outstanding" value={outstanding ? formatCurrency(outstanding.totalOutstanding) : "—"} tone="neutral" />
        <StatTile label="Total discounts" value={discounts ? formatCurrency(discounts.totalDiscounts) : "—"} icon={Coins} tone="neutral" />
        <StatTile label="Total scholarships" value={scholarships ? formatCurrency(scholarships.totalScholarships) : "—"} icon={Gift} tone="neutral" />
      </div>

      {collection && (
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Collection by method</h2>
          <div className="flex flex-col gap-1">
            {collection.byMethod.map((m) => (
              <div key={m.method} className="flex items-center justify-between text-sm">
                <span className="capitalize text-foreground">{m.method.replace("_", " ")}</span>
                <span className="text-muted-foreground">
                  {m.count} payment{m.count === 1 ? "" : "s"} · <span className="font-medium text-foreground">{formatCurrency(m.amount)}</span>
                </span>
              </div>
            ))}
            {collection.byMethod.length === 0 && <p className="text-sm text-muted-foreground">No payments recorded yet.</p>}
          </div>
        </div>
      )}

      {collection && collection.byCategory.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Collection by category</h2>
          <div className="flex flex-col gap-1">
            {collection.byCategory.map((c) => (
              <div key={c.categoryName} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{c.categoryName}</span>
                <span className="font-medium text-foreground">{formatCurrency(c.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {outstanding && outstanding.byClass.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Outstanding by class</h2>
          <div className="flex flex-col gap-1">
            {outstanding.byClass.map((c) => (
              <div key={c.classId} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{c.className}</span>
                <span className="flex gap-sm text-xs text-muted-foreground">
                  <span>Overdue {formatCurrency(c.overdue)}</span>
                  <span className="font-medium text-foreground">{formatCurrency(c.outstanding)}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {refunds && (
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <PiggyBank className="size-4" /> Refunds
          </h2>
          <p className="text-sm text-muted-foreground">
            {refunds.count} refund{refunds.count === 1 ? "" : "s"} · <span className="font-medium text-foreground">{formatCurrency(refunds.totalRefunded)}</span> total
          </p>
        </div>
      )}
    </div>
  );
}
