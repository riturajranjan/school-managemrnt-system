import { getSnapshot, setState } from "@/lib/data/store";
import type { Expense, ExpenseCategory, Income, IncomeCategory } from "@/lib/types/accounting";
import type { PaymentMethod } from "@/lib/types/payments";
import { addMoney, zeroMoney, type Money } from "@/lib/finance/money";
import { generateId } from "@/lib/utils";
import { logFinancialAudit } from "./finance-audit-service";
import { postJournalEntry } from "./journal-service";

type Actor = { name: string; role: string };

export const expenseCategoryAccountId: Record<ExpenseCategory, string> = {
  salaries: "coa-expense-salaries",
  utilities: "coa-expense-utilities",
  rent: "coa-expense-rent",
  maintenance: "coa-expense-maintenance",
  transport: "coa-expense-other",
  "academic-materials": "coa-expense-academic",
  laboratory: "coa-expense-academic",
  library: "coa-expense-academic",
  events: "coa-expense-other",
  marketing: "coa-expense-marketing",
  technology: "coa-expense-technology",
  training: "coa-expense-other",
  travel: "coa-expense-other",
  "vendor-payments": "coa-expense-other",
  taxes: "coa-expense-other",
  "other-expense": "coa-expense-other",
};

export const incomeCategoryAccountId: Record<IncomeCategory, string> = {
  fees: "coa-income-other-fee",
  donations: "coa-income-donations",
  grants: "coa-income-donations",
  sponsorship: "coa-income-donations",
  "rental-income": "coa-income-other-fee",
  "event-income": "coa-income-other-fee",
  "sale-of-materials": "coa-income-other-fee",
  interest: "coa-income-other-fee",
  "other-income": "coa-income-other-fee",
};

function cashOrBankAccountId(method: PaymentMethod): string {
  return method === "cash" ? "coa-cash" : "coa-bank";
}

export type IncomeInput = { category: IncomeCategory; amount: Money; date: string; source: string; branch: string; description?: string };

export function recordIncome(input: IncomeInput, actor: Actor): Income {
  const income: Income = { id: generateId("inc"), ...input, accountId: incomeCategoryAccountId[input.category], createdBy: actor.name, createdAt: new Date().toISOString() };
  setState((db) => ({ ...db, incomes: [...db.incomes, income] }));
  postJournalEntry(
    { date: input.date, sourceType: "manual", sourceId: income.id, narration: `Income: ${input.source}`, lines: [{ accountId: "coa-bank", debit: input.amount, credit: zeroMoney(input.amount.currency) }, { accountId: incomeCategoryAccountId[input.category], debit: zeroMoney(input.amount.currency), credit: input.amount }] },
    actor,
  );
  logFinancialAudit({ action: "journal-posted", actorName: actor.name, actorRole: actor.role, summary: `Income of ${input.amount.minorUnits / 100} recorded: ${input.source}.` });
  return income;
}

export type ExpenseDraft = Omit<Expense, "id" | "expenseNumber" | "status" | "createdBy" | "createdAt" | "approvedBy" | "approvedAt" | "paidAt" | "accountId">;

function nextExpenseNumber(count: number): string {
  return `EXP-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
}

export function createExpense(draft: ExpenseDraft, actor: Actor): Expense {
  const db = getSnapshot();
  const expense: Expense = { ...draft, id: generateId("exp"), expenseNumber: nextExpenseNumber(db.expenses.length), accountId: expenseCategoryAccountId[draft.category], status: "submitted", createdBy: actor.name, createdAt: new Date().toISOString() };
  setState((current) => ({ ...current, expenses: [...current.expenses, expense] }));
  logFinancialAudit({ action: "expense-created", actorName: actor.name, actorRole: actor.role, summary: `Expense ${expense.expenseNumber} created: ${expense.description}.` });
  return expense;
}

export function approveExpense(expenseId: string, actor: Actor): { ok: true } | { ok: false; error: string } {
  const db = getSnapshot();
  const expense = db.expenses.find((e) => e.id === expenseId);
  if (!expense) return { ok: false, error: "Expense not found." };
  if (expense.status !== "submitted" && expense.status !== "under-review") return { ok: false, error: `Cannot approve an expense in "${expense.status}" status.` };

  setState((current) => ({ ...current, expenses: current.expenses.map((e) => (e.id === expenseId ? { ...e, status: "approved", approvedBy: actor.name, approvedAt: new Date().toISOString() } : e)) }));
  logFinancialAudit({ action: "expense-approved", actorName: actor.name, actorRole: actor.role, summary: `Expense ${expense.expenseNumber} approved.` });
  return { ok: true };
}

export function rejectExpense(expenseId: string, reason: string, actor: Actor) {
  setState((db) => ({ ...db, expenses: db.expenses.map((e) => (e.id === expenseId ? { ...e, status: "rejected" } : e)) }));
  const expense = getSnapshot().expenses.find((e) => e.id === expenseId);
  if (expense) logFinancialAudit({ action: "expense-rejected", actorName: actor.name, actorRole: actor.role, summary: `Expense ${expense.expenseNumber} rejected.`, reason });
}

/** Marks an approved expense paid and posts its journal entry — the two
 * always happen together, since "paid" without a ledger movement would be a
 * silent inconsistency (spec: no impossible combinations). */
export function markExpensePaid(expenseId: string, actor: Actor): { ok: true } | { ok: false; error: string } {
  const db = getSnapshot();
  const expense = db.expenses.find((e) => e.id === expenseId);
  if (!expense) return { ok: false, error: "Expense not found." };
  if (expense.status !== "approved") return { ok: false, error: "Only an approved expense can be marked paid." };

  const now = new Date().toISOString();
  const total = addMoney(expense.amount, expense.tax);
  const journal = postJournalEntry(
    {
      date: now.slice(0, 10),
      sourceType: "expense",
      sourceId: expense.id,
      narration: `${expense.expenseNumber} — ${expense.description}`,
      lines: [{ accountId: expense.accountId ?? expenseCategoryAccountId[expense.category], debit: total, credit: zeroMoney(total.currency) }, { accountId: cashOrBankAccountId(expense.paymentMethod), debit: zeroMoney(total.currency), credit: total }],
    },
    actor,
  );
  if (!journal.ok) return { ok: false, error: journal.error };

  setState((current) => ({ ...current, expenses: current.expenses.map((e) => (e.id === expenseId ? { ...e, status: "paid", paidAt: now } : e)) }));
  logFinancialAudit({ action: "expense-paid", actorName: actor.name, actorRole: actor.role, summary: `Expense ${expense.expenseNumber} paid via journal ${journal.entry.entryNumber}.` });
  return { ok: true };
}
