import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { computeMatchSuggestions, confirmMatch, ignoreTransaction, isDuplicateTransaction, markAsFee, reconciliationStatusFor, undoReconciliation } from "./reconciliation-service";

const ACTOR = { name: "Accountant", role: "Accountant" };

describe("computeMatchSuggestions (seed data)", () => {
  beforeEach(() => resetDemoData());

  it("suggests at least one match given the seeded bank statement mirrors real payments", () => {
    const db = getSnapshot();
    const suggestions = computeMatchSuggestions(db);
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it("sorts suggestions by confidence, highest first", () => {
    const db = getSnapshot();
    const suggestions = computeMatchSuggestions(db);
    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i - 1].confidence).toBeGreaterThanOrEqual(suggestions[i].confidence);
    }
  });

  it("never suggests a payment or transaction that's already reconciled", () => {
    const db = getSnapshot();
    const suggestions = computeMatchSuggestions(db);
    if (suggestions.length === 0) return;
    const first = suggestions[0];
    confirmMatch(first.bankTransactionId, first.paymentId, ACTOR);
    const after = computeMatchSuggestions(getSnapshot());
    expect(after.some((s) => s.bankTransactionId === first.bankTransactionId || s.paymentId === first.paymentId)).toBe(false);
  });
});

describe("confirmMatch / reconciliationStatusFor", () => {
  beforeEach(() => resetDemoData());

  it("marks the transaction reconciled once matched", () => {
    const db = getSnapshot();
    const suggestions = computeMatchSuggestions(db);
    if (suggestions.length === 0) return;
    const { bankTransactionId, paymentId } = suggestions[0];
    expect(reconciliationStatusFor(getSnapshot(), bankTransactionId)).toBe("unmatched");
    confirmMatch(bankTransactionId, paymentId, ACTOR);
    expect(reconciliationStatusFor(getSnapshot(), bankTransactionId)).toBe("reconciled");
  });
});

describe("ignoreTransaction / undoReconciliation", () => {
  beforeEach(() => resetDemoData());

  it("marks a transaction ignored with its reason", () => {
    const txn = getSnapshot().bankTransactions[0];
    ignoreTransaction(txn.id, "Not a school transaction", ACTOR);
    const record = getSnapshot().reconciliationRecords.find((r) => r.bankTransactionId === txn.id);
    expect(record?.status).toBe("ignored");
    expect(record?.ignoredReason).toBe("Not a school transaction");
  });

  it("reverts a transaction back to unmatched", () => {
    const txn = getSnapshot().bankTransactions[0];
    ignoreTransaction(txn.id, "test", ACTOR);
    expect(reconciliationStatusFor(getSnapshot(), txn.id)).toBe("ignored");
    undoReconciliation(txn.id, ACTOR);
    expect(reconciliationStatusFor(getSnapshot(), txn.id)).toBe("unmatched");
  });
});

describe("markAsFee", () => {
  beforeEach(() => resetDemoData());

  it("books an expense and marks the transaction reconciled", () => {
    const txn = getSnapshot().bankTransactions[0];
    const expenseCountBefore = getSnapshot().expenses.length;
    const record = markAsFee(txn.id, "bank-charge", ACTOR);
    expect(record?.status).toBe("reconciled");
    expect(getSnapshot().expenses.length).toBe(expenseCountBefore + 1);
    const expense = getSnapshot().expenses[getSnapshot().expenses.length - 1];
    expect(expense.amount.minorUnits).toBe(txn.amount.minorUnits);
  });
});

describe("isDuplicateTransaction (seed data)", () => {
  it("flags the seeded duplicate transaction", () => {
    resetDemoData();
    const db = getSnapshot();
    expect(db.bankTransactions.some((t) => isDuplicateTransaction(db, t.id))).toBe(true);
  });
});
