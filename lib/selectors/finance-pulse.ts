import type { Db } from "@/lib/data/store";
import { reconciliationStatusFor } from "@/lib/services/reconciliation-service";
import { actualForLine, isOverThreshold } from "./budget-insights";
import { totalOutstanding as feeItemsTotalOutstanding } from "./fee-item-insights";
import { totalCollected } from "./finance-reports";

export type FinancePulseComponent = { key: string; label: string; value: number; weight: number };
export type FinancePulse = { score: number; components: FinancePulseComponent[] };

/** A real, computed operational score (0-100) — every component is derived
 * from actual store data, never a placeholder. Weighted average of four
 * signals: fee collection health, overdue-dues health, bank reconciliation
 * health, and budget health. Clamped to [0, 100]. */
export function computeFinancePulse(db: Db): FinancePulse {
  const collected = totalCollected(db).minorUnits;
  const outstanding = feeItemsTotalOutstanding(db.studentFeeItems).minorUnits;
  const collectionHealth = collected + outstanding > 0 ? collected / (collected + outstanding) : 1;

  const unpaidItems = db.studentFeeItems.filter((i) => i.status !== "paid" && i.status !== "waived" && i.status !== "cancelled");
  const overdueItems = unpaidItems.filter((i) => i.status === "overdue");
  const duesHealth = unpaidItems.length > 0 ? 1 - overdueItems.length / unpaidItems.length : 1;

  const reconciledCount = db.bankTransactions.filter((t) => reconciliationStatusFor(db, t.id) === "reconciled" || reconciliationStatusFor(db, t.id) === "matched" || reconciliationStatusFor(db, t.id) === "ignored").length;
  const reconciliationHealth = db.bankTransactions.length > 0 ? reconciledCount / db.bankTransactions.length : 1;

  const budgets = db.budgets.filter((b) => b.status === "approved" || b.status === "revised");
  const budgetLines = budgets.flatMap((b) => b.lines.map((line) => ({ line, financialYear: b.financialYear })));
  const healthyLines = budgetLines.filter(({ line, financialYear }) => !isOverThreshold(actualForLine(db, line, financialYear), line));
  const budgetHealth = budgetLines.length > 0 ? healthyLines.length / budgetLines.length : 1;

  const components: FinancePulseComponent[] = [
    { key: "collection", label: "Fee collection", value: Math.round(collectionHealth * 100), weight: 0.35 },
    { key: "dues", label: "Overdue dues", value: Math.round(duesHealth * 100), weight: 0.25 },
    { key: "reconciliation", label: "Bank reconciliation", value: Math.round(reconciliationHealth * 100), weight: 0.2 },
    { key: "budget", label: "Budget adherence", value: Math.round(budgetHealth * 100), weight: 0.2 },
  ];

  const score = Math.max(0, Math.min(100, Math.round(components.reduce((sum, c) => sum + c.value * c.weight, 0))));
  return { score, components };
}
