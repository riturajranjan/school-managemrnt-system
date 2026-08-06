"use client";

import { useState } from "react";
import Papa from "papaparse";
import { BookOpen, Download, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { formatMoney, type Money } from "@/lib/finance/money";
import { cashFlowSummary, incomeStatement, trialBalance } from "@/lib/selectors/finance-reports";
import { chartOfAccountTypeLabels } from "@/lib/types/accounting";
import { downloadTextFile } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Tab = "income-statement" | "cash-flow" | "trial-balance";

const tabs: { key: Tab; label: string }[] = [
  { key: "income-statement", label: "Income statement" },
  { key: "cash-flow", label: "Cash flow" },
  { key: "trial-balance", label: "Trial balance" },
];

export default function AccountingReportsPage() {
  const db = useSisStore();
  const { can } = usePermissions();
  const canExport = can("accounting.viewReports");
  const [tab, setTab] = useState<Tab>("income-statement");

  const statement = incomeStatement(db);
  const cashFlow = cashFlowSummary(db);
  const trial = trialBalance(db);

  function exportCsv() {
    if (tab === "income-statement") {
      const rows = [...statement.incomeByAccount.map((r) => ({ Type: "Income", Account: r.name, Amount: formatMoney(r.amount) })), ...statement.expenseByAccount.map((r) => ({ Type: "Expense", Account: r.name, Amount: formatMoney(r.amount) }))];
      downloadTextFile("income-statement.csv", Papa.unparse(rows));
    } else if (tab === "cash-flow") {
      downloadTextFile("cash-flow.csv", Papa.unparse(cashFlow.map((r) => ({ Account: r.name, Inflow: formatMoney(r.inflow), Outflow: formatMoney(r.outflow) }))));
    } else {
      downloadTextFile("trial-balance.csv", Papa.unparse(trial.map((r) => ({ Code: r.code, Account: r.name, Type: chartOfAccountTypeLabels[r.type as keyof typeof chartOfAccountTypeLabels], Balance: formatMoney(r.balance) }))));
    }
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Accounting reports</h1>
          <p className="text-xs text-muted-foreground">Income statement, cash flow and trial balance — all derived live from the posted ledger</p>
        </div>
        {canExport && (
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="size-3.5" />
            Export CSV
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-sm">
        <StatTile label="Total income" value={formatMoney(statement.totalIncome, { compact: true })} icon={TrendingUp} tone="success" />
        <StatTile label="Total expense" value={formatMoney(statement.totalExpense, { compact: true })} icon={TrendingDown} tone="neutral" />
        <StatTile label="Net income" value={formatMoney(statement.netIncome, { compact: true })} icon={Scale} tone={statement.netIncome.minorUnits >= 0 ? "success" : "error"} />
      </div>

      <div className="flex items-center gap-1 rounded-md bg-surface-secondary p-1">
        {tabs.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} className={cn("min-h-8 flex-1 rounded-md px-sm text-xs font-medium transition-colors", tab === t.key ? "bg-surface shadow-card text-foreground" : "text-muted-foreground")}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "income-statement" && (
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

      {tab === "cash-flow" && (
        <div className="surface-3d rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Cash & bank movement</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[360px] text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="p-xs text-left">Account</th>
                  <th className="p-xs text-right">Inflow</th>
                  <th className="p-xs text-right">Outflow</th>
                  <th className="p-xs text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {cashFlow.map((row) => (
                  <tr key={row.accountId} className="border-t border-border">
                    <td className="p-xs text-foreground">{row.name}</td>
                    <td className="p-xs text-right text-success">{formatMoney(row.inflow)}</td>
                    <td className="p-xs text-right text-error">{formatMoney(row.outflow)}</td>
                    <td className="p-xs text-right font-medium text-foreground">{formatMoney({ minorUnits: row.inflow.minorUnits - row.outflow.minorUnits, currency: "INR" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "trial-balance" && (
        <div className="surface-3d rounded-lg border border-border bg-surface p-md">
          <div className="mb-sm flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <BookOpen className="size-4" />
            Trial balance
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
                {trial.map((row) => (
                  <tr key={row.accountId} className="border-t border-border">
                    <td className="p-xs text-muted-foreground">{row.code}</td>
                    <td className="p-xs text-foreground">{row.name}</td>
                    <td className="p-xs text-muted-foreground">{chartOfAccountTypeLabels[row.type as keyof typeof chartOfAccountTypeLabels]}</td>
                    <td className="p-xs text-right font-medium text-foreground">{formatMoney(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ReportTable({ rows }: { rows: { name: string; amount: Money }[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No entries.</p>;
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((row) => (
          <tr key={row.name} className="border-t border-border first:border-t-0">
            <td className="py-1 text-foreground">{row.name}</td>
            <td className="py-1 text-right font-medium text-foreground">{formatMoney(row.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
