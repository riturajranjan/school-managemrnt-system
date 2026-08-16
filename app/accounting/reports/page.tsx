"use client";

// Real PostgreSQL/API cutover (Phase 9G) — reads GET /api/accounting/reports/
// income-expense and GET /api/accounting/trial-balance, both derived from
// POSTED journal lines only. The mock's "Cash flow" tab is dropped — it
// duplicated a per-account view the real Ledger page already provides for
// the CASH/BANK accounts, and Balance Sheet/P&L beyond income-expense are
// honestly deferred (no opening-equity/current-earnings policy exists yet).
import { useState } from "react";
import Papa from "papaparse";
import { BookOpen, Download, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useIncomeExpenseReport, useTrialBalance } from "@/lib/hooks/api/use-accounting-api";
import { downloadTextFile, formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Tab = "income-statement" | "trial-balance";
const tabs: { key: Tab; label: string }[] = [
  { key: "income-statement", label: "Income statement" },
  { key: "trial-balance", label: "Trial balance" },
];
const typeLabels: Record<string, string> = { asset: "Asset", liability: "Liability", equity: "Equity", income: "Income", expense: "Expense" };

export default function AccountingReportsPage() {
  const { can } = usePermissions();
  const canExport = can("accounting.view");
  const [tab, setTab] = useState<Tab>("income-statement");

  const { data: statement } = useIncomeExpenseReport();
  const { data: trial } = useTrialBalance();

  function exportCsv() {
    if (tab === "income-statement" && statement) {
      const rows = [...statement.incomeByAccount.map((r) => ({ Type: "Income", Account: r.name, Amount: formatCurrency(r.amount) })), ...statement.expenseByAccount.map((r) => ({ Type: "Expense", Account: r.name, Amount: formatCurrency(r.amount) }))];
      downloadTextFile("income-statement.csv", Papa.unparse(rows));
    } else if (trial) {
      downloadTextFile("trial-balance.csv", Papa.unparse(trial.rows.map((r) => ({ Code: r.code, Account: r.name, Type: typeLabels[r.type], Balance: formatCurrency(r.balance) }))));
    }
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Accounting reports</h1>
          <p className="text-xs text-muted-foreground">Income statement and trial balance — derived live from the posted ledger</p>
        </div>
        {canExport && (
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="size-3.5" />
            Export CSV
          </Button>
        )}
      </div>

      {statement && (
        <div className="grid grid-cols-3 gap-sm">
          <StatTile label="Total income" value={formatCurrency(statement.totalIncome)} icon={TrendingUp} tone="success" />
          <StatTile label="Total expense" value={formatCurrency(statement.totalExpense)} icon={TrendingDown} tone="neutral" />
          <StatTile label="Net income" value={formatCurrency(statement.netIncome)} icon={Scale} tone={statement.netIncome >= 0 ? "success" : "error"} />
        </div>
      )}

      <div className="flex items-center gap-1 rounded-md bg-surface-secondary p-1">
        {tabs.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} className={cn("min-h-8 flex-1 rounded-md px-sm text-xs font-medium transition-colors", tab === t.key ? "bg-surface shadow-card text-foreground" : "text-muted-foreground")}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "income-statement" && statement && (
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          <div className="surface-3d rounded-lg border border-border bg-surface p-md">
            <h2 className="mb-sm text-sm font-semibold text-foreground">Income</h2>
            <ReportTable rows={statement.incomeByAccount} />
          </div>
          <div className="surface-3d rounded-lg border border-border bg-surface p-md">
            <h2 className="mb-sm text-sm font-semibold text-foreground">Expense</h2>
            <ReportTable rows={statement.expenseByAccount} />
          </div>
        </div>
      )}

      {tab === "trial-balance" && trial && (
        <div className="surface-3d rounded-lg border border-border bg-surface p-md">
          <div className="mb-sm flex items-center justify-between gap-sm">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <BookOpen className="size-4" />
              Trial balance
            </div>
            <span className={cn("text-xs font-medium", trial.balanced ? "text-success" : "text-error")}>{trial.balanced ? "Debits = Credits" : "OUT OF BALANCE"}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px] text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="p-xs text-left">Code</th>
                  <th className="p-xs text-left">Account</th>
                  <th className="p-xs text-left">Type</th>
                  <th className="p-xs text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {trial.rows.map((row) => (
                  <tr key={row.accountId} className="border-t border-border">
                    <td className="p-xs text-muted-foreground">{row.code}</td>
                    <td className="p-xs text-foreground">{row.name}</td>
                    <td className="p-xs text-muted-foreground">{typeLabels[row.type]}</td>
                    <td className="p-xs text-right font-medium text-foreground">{formatCurrency(row.balance)}</td>
                  </tr>
                ))}
                {trial.rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-sm text-center text-muted-foreground">No posted activity yet.</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-medium text-foreground">
                  <td className="p-xs" colSpan={3}>Total</td>
                  <td className="p-xs text-right">{formatCurrency(trial.totalDebit)} Dr / {formatCurrency(trial.totalCredit)} Cr</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportTable({ rows }: { rows: { name: string; amount: number }[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No entries.</p>;
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((row) => (
          <tr key={row.name} className="border-t border-border first:border-t-0">
            <td className="py-1 text-foreground">{row.name}</td>
            <td className="py-1 text-right font-medium text-foreground">{formatCurrency(row.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
