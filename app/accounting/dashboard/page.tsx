"use client";

// Real PostgreSQL/API cutover (Phase 9G) — reads GET /api/accounting/dashboard.
// The mock Finance Pulse gauge and cross-module exception feed (pending POs/
// over-budget — Purchase Orders and Budgets are out of this phase's scope,
// see the Accounting hub page) are dropped; replaced with real ledger-derived
// KPIs and a trial-balance integrity indicator.
import Link from "next/link";
import { AlertTriangle, BookOpen, CheckCircle2, Landmark, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useAccountingDashboard } from "@/lib/hooks/api/use-accounting-api";
import { roleLabels } from "@/lib/permissions/roles";
import { formatCurrency, formatDate } from "@/lib/utils";

const sourceLabels: Record<string, string> = { manual: "Manual", fee_payment: "Fee payment", fee_refund: "Fee refund", payroll_payment: "Payroll payment", staff_advance_disbursement: "Loan/advance disbursement", staff_advance_repayment: "Loan/advance repayment" };

export default function AccountingDashboardPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data, loading, error } = useAccountingDashboard();
  if (!capabilitiesLoading && !hasServerPermission("accounting.view")) return <PermissionDenied action="view the accounting module" role={roleLabels[role]} backHref="/accounting" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Accounting dashboard</h1>
        <p className="text-xs text-muted-foreground">Month-to-date income/expense, cash position and ledger integrity</p>
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}
      {loading && !data && <p className="text-xs text-muted-foreground">Loading…</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
            <StatTile label="Income (MTD)" value={formatCurrency(data.totalIncome)} icon={TrendingUp} tone="success" />
            <StatTile label="Expense (MTD)" value={formatCurrency(data.totalExpense)} icon={TrendingDown} tone="neutral" />
            <StatTile label="Net income (MTD)" value={formatCurrency(data.netIncome)} icon={Scale} tone={data.netIncome >= 0 ? "success" : "error"} />
            <StatTile label="Cash & bank balance" value={formatCurrency(data.cashAndBankBalance)} icon={Landmark} tone={data.cashAndBankBalance >= 0 ? "success" : "error"} />
          </div>

          <div className="grid grid-cols-1 gap-md lg:grid-cols-3">
            <div className="surface-3d flex flex-col items-center justify-center gap-sm rounded-lg border border-border bg-surface p-md lg:col-span-1">
              <h2 className="self-start text-sm font-semibold text-foreground">Ledger integrity</h2>
              {data.trialBalanceOk ? (
                <div className="flex flex-col items-center gap-xs py-md text-success">
                  <CheckCircle2 className="size-8" />
                  <p className="text-sm font-medium">Debits = Credits</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-xs py-md text-error">
                  <AlertTriangle className="size-8" />
                  <p className="text-sm font-medium">Out of balance</p>
                </div>
              )}
              {data.unreconciledFeeCollections > 0 && (
                <Link href="/accounting/bank-reconciliation" className="flex items-center justify-between gap-sm rounded-md border border-warning/30 bg-warning/8 p-sm text-xs text-warning">
                  <span>{data.unreconciledFeeCollections} unreconciled fee collection{data.unreconciledFeeCollections === 1 ? "" : "s"}</span>
                  <Badge tone="warning">Review</Badge>
                </Link>
              )}
            </div>

            <div className="surface-3d rounded-lg border border-border bg-surface p-md lg:col-span-2">
              <h2 className="mb-sm flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <BookOpen className="size-4" /> Recent journals
              </h2>
              {data.recentJournals.length === 0 ? (
                <p className="text-sm text-muted-foreground">No journal entries yet.</p>
              ) : (
                <ul className="flex flex-col gap-xs">
                  {data.recentJournals.map((j) => (
                    <li key={j.id}>
                      <Link href="/accounting/journals" className="flex items-center justify-between gap-sm rounded-md border border-border p-sm transition-colors hover:border-primary/40">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{j.entryNumber} — {j.description}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(j.entryDate)} · {sourceLabels[j.sourceType]}</p>
                        </div>
                        <span className="shrink-0 text-sm font-medium text-foreground">{formatCurrency(j.totalAmount)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
