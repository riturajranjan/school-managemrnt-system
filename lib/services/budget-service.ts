import { getSnapshot, setState } from "@/lib/data/store";
import type { Budget, BudgetLine } from "@/lib/types/accounting";
import { zeroMoney } from "@/lib/finance/money";
import { generateId } from "@/lib/utils";
import { logFinancialAudit } from "./finance-audit-service";

type Actor = { name: string; role: string };

export type BudgetLineDraft = Pick<BudgetLine, "category" | "plannedAmount" | "alertThresholdPercent">;
export type BudgetDraft = { name: string; session: string; financialYear: string; branch: string; department?: string; costCentre?: string; lines: BudgetLineDraft[] };

export function createBudget(draft: BudgetDraft, actor: Actor): Budget {
  const budgetId = generateId("budget");
  const budget: Budget = {
    id: budgetId,
    name: draft.name,
    session: draft.session,
    financialYear: draft.financialYear,
    branch: draft.branch,
    department: draft.department,
    costCentre: draft.costCentre,
    lines: draft.lines.map((l) => ({ id: generateId("bl"), budgetId, category: l.category, plannedAmount: l.plannedAmount, committedAmount: zeroMoney(l.plannedAmount.currency), actualAmount: zeroMoney(l.plannedAmount.currency), alertThresholdPercent: l.alertThresholdPercent })),
    status: "draft",
    createdBy: actor.name,
    createdAt: new Date().toISOString(),
  };
  setState((db) => ({ ...db, budgets: [...db.budgets, budget] }));
  logFinancialAudit({ action: "budget-created", actorName: actor.name, actorRole: actor.role, summary: `Budget "${budget.name}" created with ${budget.lines.length} line(s).` });
  return budget;
}

export function approveBudget(budgetId: string, actor: Actor): { ok: true } | { ok: false; error: string } {
  const db = getSnapshot();
  const budget = db.budgets.find((b) => b.id === budgetId);
  if (!budget) return { ok: false, error: "Budget not found." };
  if (budget.status !== "draft") return { ok: false, error: `Cannot approve a budget in "${budget.status}" status.` };
  setState((current) => ({ ...current, budgets: current.budgets.map((b) => (b.id === budgetId ? { ...b, status: "approved" } : b)) }));
  logFinancialAudit({ action: "budget-created", actorName: actor.name, actorRole: actor.role, summary: `Budget "${budget.name}" approved.` });
  return { ok: true };
}

/** Budgets are revised, never edited in place — a revision is a new Budget
 * row referencing the original via `revisionOf`, so historical planned
 * figures always stay intact (spec: preserve historical records). */
export function reviseBudget(budgetId: string, lines: BudgetLineDraft[], actor: Actor): { ok: true; budget: Budget } | { ok: false; error: string } {
  const db = getSnapshot();
  const original = db.budgets.find((b) => b.id === budgetId);
  if (!original) return { ok: false, error: "Budget not found." };

  const revisionId = generateId("budget");
  const revision: Budget = {
    ...original,
    id: revisionId,
    lines: lines.map((l) => ({ id: generateId("bl"), budgetId: revisionId, category: l.category, plannedAmount: l.plannedAmount, committedAmount: zeroMoney(l.plannedAmount.currency), actualAmount: zeroMoney(l.plannedAmount.currency), alertThresholdPercent: l.alertThresholdPercent })),
    status: "draft",
    createdBy: actor.name,
    createdAt: new Date().toISOString(),
    revisionOf: budgetId,
  };
  setState((current) => ({ ...current, budgets: [...current.budgets.map((b) => (b.id === budgetId ? { ...b, status: "revised" as const } : b)), revision] }));
  logFinancialAudit({ action: "budget-revised", actorName: actor.name, actorRole: actor.role, summary: `Budget "${original.name}" revised.` });
  return { ok: true, budget: revision };
}
