import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { moneyFromMajor, zeroMoney } from "@/lib/finance/money";
import { approveExpense, createExpense, markExpensePaid, recordIncome, rejectExpense, type ExpenseDraft } from "./income-expense-service";

const ACTOR = { name: "Accountant", role: "Accountant" };

function draft(overrides: Partial<ExpenseDraft> = {}): ExpenseDraft {
  return {
    date: "2026-08-05",
    category: "technology",
    amount: moneyFromMajor(5000, "INR"),
    tax: zeroMoney("INR"),
    paymentMethod: "bank-transfer",
    branch: "main",
    description: "Test expense",
    recurring: false,
    ...overrides,
  };
}

describe("recordIncome", () => {
  beforeEach(() => resetDemoData());

  it("creates an income record and posts a balanced journal entry", () => {
    const journalCountBefore = getSnapshot().journalEntries.length;
    const income = recordIncome({ category: "donations", amount: moneyFromMajor(10000, "INR"), date: "2026-08-05", source: "Alumni donation", branch: "main" }, ACTOR);
    const after = getSnapshot();
    expect(after.incomes.some((i) => i.id === income.id)).toBe(true);
    expect(after.journalEntries.length).toBe(journalCountBefore + 1);
  });
});

describe("createExpense / approveExpense / rejectExpense / markExpensePaid", () => {
  beforeEach(() => resetDemoData());

  it("creates an expense in submitted status with a sequential expense number", () => {
    const expense = createExpense(draft(), ACTOR);
    expect(expense.status).toBe("submitted");
    expect(expense.expenseNumber).toMatch(/^EXP-\d{4}-\d{4}$/);
  });

  it("refuses to mark an unapproved expense paid", () => {
    const expense = createExpense(draft(), ACTOR);
    const result = markExpensePaid(expense.id, ACTOR);
    expect(result.ok).toBe(false);
  });

  it("approves, then pays an expense, posting a balanced journal on payment", () => {
    const expense = createExpense(draft(), ACTOR);
    const approveResult = approveExpense(expense.id, ACTOR);
    expect(approveResult.ok).toBe(true);
    expect(getSnapshot().expenses.find((e) => e.id === expense.id)?.status).toBe("approved");

    const journalCountBefore = getSnapshot().journalEntries.length;
    const payResult = markExpensePaid(expense.id, ACTOR);
    expect(payResult.ok).toBe(true);
    const after = getSnapshot();
    expect(after.expenses.find((e) => e.id === expense.id)?.status).toBe("paid");
    expect(after.journalEntries.length).toBe(journalCountBefore + 1);

    const entry = after.journalEntries[after.journalEntries.length - 1];
    const totalDebit = entry.lines.reduce((sum, l) => sum + l.debit.minorUnits, 0);
    const totalCredit = entry.lines.reduce((sum, l) => sum + l.credit.minorUnits, 0);
    expect(totalDebit).toBe(totalCredit);
  });

  it("rejecting an expense marks it rejected without posting a journal", () => {
    const expense = createExpense(draft(), ACTOR);
    const journalCountBefore = getSnapshot().journalEntries.length;
    rejectExpense(expense.id, "Not approved by budget owner", ACTOR);
    const after = getSnapshot();
    expect(after.expenses.find((e) => e.id === expense.id)?.status).toBe("rejected");
    expect(after.journalEntries.length).toBe(journalCountBefore);
  });

  it("refuses to approve an already-approved expense a second time", () => {
    const expense = createExpense(draft(), ACTOR);
    approveExpense(expense.id, ACTOR);
    const second = approveExpense(expense.id, ACTOR);
    expect(second.ok).toBe(false);
  });
});
