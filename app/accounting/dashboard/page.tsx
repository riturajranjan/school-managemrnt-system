"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Landmark, Scale, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { FinancePulseGauge } from "@/components/finance/finance-pulse-gauge";
import { useSisStore } from "@/lib/hooks/use-store";
import { formatMoney } from "@/lib/finance/money";
import { financeExceptions } from "@/lib/selectors/finance-brief";
import { computeFinancePulse } from "@/lib/selectors/finance-pulse";
import { cashFlowSummary, incomeStatement } from "@/lib/selectors/finance-reports";

const severityTone = { high: "error", medium: "warning", low: "neutral" } as const;
const accountingExceptionIds = new Set(["pending-expenses", "pending-pos", "unreconciled", "over-budget"]);

export default function AccountingDashboardPage() {
  const db = useSisStore();
  const statement = incomeStatement(db);
  const cashFlow = cashFlowSummary(db);
  const pulse = computeFinancePulse(db);
  const exceptions = financeExceptions(db).filter((e) => accountingExceptionIds.has(e.id));
  const cashBalance = cashFlow.reduce((sum, row) => sum + (row.inflow.minorUnits - row.outflow.minorUnits), 0);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Accounting dashboard</h1>
        <p className="text-xs text-muted-foreground">Income statement, cash position and reconciliation health</p>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Total income" value={formatMoney(statement.totalIncome, { compact: true })} icon={TrendingUp} tone="success" />
        <StatTile label="Total expense" value={formatMoney(statement.totalExpense, { compact: true })} icon={TrendingDown} tone="neutral" />
        <StatTile label="Net income" value={formatMoney(statement.netIncome, { compact: true })} icon={Scale} tone={statement.netIncome.minorUnits >= 0 ? "success" : "error"} />
        <StatTile label="Cash & bank balance" value={formatMoney({ minorUnits: cashBalance, currency: "INR" }, { compact: true })} icon={Landmark} tone={cashBalance >= 0 ? "success" : "error"} />
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-3">
        <div className="surface-3d flex flex-col items-center rounded-lg border border-border bg-surface p-md lg:col-span-1">
          <h2 className="mb-sm self-start text-sm font-semibold text-foreground">Finance Pulse</h2>
          <FinancePulseGauge score={pulse.score} components={pulse.components} />
        </div>

        <div className="surface-3d rounded-lg border border-border bg-surface p-md lg:col-span-2">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Accounting exceptions</h2>
          {exceptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No accounting exceptions — expenses, purchase orders and reconciliation are all current.</p>
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
        </div>
      </div>
    </div>
  );
}
