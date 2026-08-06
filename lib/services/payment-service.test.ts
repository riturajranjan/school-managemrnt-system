import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { moneyFromMajor } from "@/lib/finance/money";
import { outstandingForItem } from "@/lib/selectors/fee-item-insights";
import { nextReceiptNumber, recordPayment, applyCreditToPayment, validatePaymentInput } from "./payment-service";

const ACTOR = { name: "Cashier", role: "Cashier" };

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    studentId: "",
    itemIds: [] as string[],
    amount: moneyFromMajor(0, "INR"),
    method: "cash" as const,
    branch: "main",
    cashierName: "Cashier",
    idempotencyKey: `test-${Math.random()}`,
    ...overrides,
  };
}

function pickUnpaidItem() {
  const db = getSnapshot();
  const item = db.studentFeeItems.find((i) => i.status === "pending" || i.status === "overdue" || i.status === "partial");
  return item ?? null;
}

describe("nextReceiptNumber", () => {
  beforeEach(() => resetDemoData());

  it("continues the sequence from the highest existing receipt number, not restarting at 1", () => {
    const db = getSnapshot();
    const maxExisting = Math.max(...db.receipts.map((r) => Number(r.receiptNumber.split("-")[2])));
    const next = nextReceiptNumber(db);
    expect(Number(next.split("-")[2])).toBe(maxExisting + 1);
  });
});

describe("validatePaymentInput", () => {
  beforeEach(() => resetDemoData());

  it("rejects a zero or negative amount", () => {
    const db = getSnapshot();
    const item = pickUnpaidItem();
    if (!item) return;
    const errors = validatePaymentInput(db, baseInput({ studentId: item.studentId, itemIds: [item.id], amount: moneyFromMajor(0, "INR") }));
    expect(errors.some((e) => e.includes("greater than zero"))).toBe(true);
  });

  it("rejects a payment against an archived student", () => {
    const db = getSnapshot();
    const archived = db.students.find((s) => s.status === "archived");
    if (!archived) return;
    const errors = validatePaymentInput(db, baseInput({ studentId: archived.id, itemIds: [], amount: moneyFromMajor(100, "INR") }));
    expect(errors.some((e) => e.includes("archived"))).toBe(true);
  });

  it("rejects a duplicate transaction reference", () => {
    const db = getSnapshot();
    const existingPayment = db.payments.find((p) => p.transactionReference && p.status === "successful");
    if (!existingPayment) return;
    const item = pickUnpaidItem();
    if (!item) return;
    const errors = validatePaymentInput(db, baseInput({ studentId: item.studentId, itemIds: [item.id], amount: moneyFromMajor(100, "INR"), transactionReference: existingPayment.transactionReference }));
    expect(errors.some((e) => e.includes("already been used"))).toBe(true);
  });

  it("requires a cheque number and date for cheque payments", () => {
    const db = getSnapshot();
    const item = pickUnpaidItem();
    if (!item) return;
    const errors = validatePaymentInput(db, baseInput({ studentId: item.studentId, itemIds: [item.id], amount: moneyFromMajor(100, "INR"), method: "cheque" }));
    expect(errors.some((e) => e.includes("Cheque number"))).toBe(true);
    expect(errors.some((e) => e.includes("Cheque date"))).toBe(true);
  });

  it("rejects an amount above what's due unless advance payment is explicitly allowed", () => {
    const db = getSnapshot();
    const item = pickUnpaidItem();
    if (!item) return;
    const due = outstandingForItem(item);
    const overpay = moneyFromMajor(due.minorUnits / 100 + 100000, "INR");
    const withoutAdvance = validatePaymentInput(db, baseInput({ studentId: item.studentId, itemIds: [item.id], amount: overpay }));
    expect(withoutAdvance.some((e) => e.includes("advance"))).toBe(true);
    const withAdvance = validatePaymentInput(db, baseInput({ studentId: item.studentId, itemIds: [item.id], amount: overpay, allowAdvance: true }));
    expect(withAdvance.some((e) => e.includes("advance"))).toBe(false);
  });

  it("rejects a future payment date", () => {
    const db = getSnapshot();
    const item = pickUnpaidItem();
    if (!item) return;
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const errors = validatePaymentInput(db, baseInput({ studentId: item.studentId, itemIds: [item.id], amount: moneyFromMajor(100, "INR"), paidAt: future }));
    expect(errors.some((e) => e.includes("future"))).toBe(true);
  });
});

describe("recordPayment", () => {
  beforeEach(() => resetDemoData());

  it("fully settles an item when the payment covers the full outstanding amount", () => {
    const item = pickUnpaidItem();
    if (!item) return;
    const due = outstandingForItem(item);
    const result = recordPayment(baseInput({ studentId: item.studentId, itemIds: [item.id], amount: due }), ACTOR);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const updated = getSnapshot().studentFeeItems.find((i) => i.id === item.id)!;
    expect(updated.status).toBe("paid");
    expect(updated.paidAmount.minorUnits).toBeGreaterThan(item.paidAmount.minorUnits);
  });

  it("marks an item partial when the payment covers less than the outstanding amount", () => {
    const item = pickUnpaidItem();
    if (!item) return;
    const due = outstandingForItem(item);
    if (due.minorUnits < 200) return;
    const half = { minorUnits: Math.floor(due.minorUnits / 2), currency: due.currency };
    const result = recordPayment(baseInput({ studentId: item.studentId, itemIds: [item.id], amount: half }), ACTOR);
    expect(result.ok).toBe(true);
    const updated = getSnapshot().studentFeeItems.find((i) => i.id === item.id)!;
    expect(updated.status).toBe("partial");
  });

  it("creates exactly one receipt whose total matches the payment amount", () => {
    const item = pickUnpaidItem();
    if (!item) return;
    const due = outstandingForItem(item);
    const result = recordPayment(baseInput({ studentId: item.studentId, itemIds: [item.id], amount: due }), ACTOR);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.receipt.total.minorUnits).toBe(due.minorUnits);
    expect(result.payment.receiptId).toBe(result.receipt.id);
  });

  it("is idempotent — resubmitting the same idempotency key returns the original payment instead of creating a duplicate", () => {
    const item = pickUnpaidItem();
    if (!item) return;
    const due = outstandingForItem(item);
    const key = "fixed-idempotency-key";
    const first = recordPayment(baseInput({ studentId: item.studentId, itemIds: [item.id], amount: due, idempotencyKey: key }), ACTOR);
    const countAfterFirst = getSnapshot().payments.length;
    const second = recordPayment(baseInput({ studentId: item.studentId, itemIds: [item.id], amount: due, idempotencyKey: key }), ACTOR);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) expect(second.payment.id).toBe(first.payment.id);
    expect(getSnapshot().payments.length).toBe(countAfterFirst);
  });

  it("refuses to record an invalid payment and leaves the store unchanged", () => {
    const paymentsBefore = getSnapshot().payments.length;
    const result = recordPayment(baseInput({ studentId: "no-such-student", itemIds: [], amount: moneyFromMajor(0, "INR") }), ACTOR);
    expect(result.ok).toBe(false);
    expect(getSnapshot().payments.length).toBe(paymentsBefore);
  });

  it("records any amount beyond the selected items' outstanding as a credit balance (advance)", () => {
    const item = pickUnpaidItem();
    if (!item) return;
    const due = outstandingForItem(item);
    const advanceTotal = { minorUnits: due.minorUnits + 50000, currency: due.currency };
    const result = recordPayment(baseInput({ studentId: item.studentId, itemIds: [item.id], amount: advanceTotal, allowAdvance: true }), ACTOR);
    expect(result.ok).toBe(true);
    const credit = getSnapshot().creditBalances.find((c) => c.studentId === item.studentId && c.source === "overpayment");
    expect(credit).toBeDefined();
    expect(credit?.amount.minorUnits).toBe(50000);
  });

  it("allocates a payment across multiple selected items in due-date order, oldest first", () => {
    const db = getSnapshot();
    const studentWithTwo = db.students.find((s) => db.studentFeeItems.filter((i) => i.studentId === s.id && (i.status === "pending" || i.status === "overdue")).length >= 2);
    if (!studentWithTwo) return;
    const items = db.studentFeeItems.filter((i) => i.studentId === studentWithTwo.id && (i.status === "pending" || i.status === "overdue")).sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
    const [first, second] = items;
    const firstDue = outstandingForItem(first);
    const amount = { minorUnits: firstDue.minorUnits + 100, currency: firstDue.currency };
    const result = recordPayment(baseInput({ studentId: studentWithTwo.id, itemIds: [first.id, second.id], amount }), ACTOR);
    expect(result.ok).toBe(true);
    const after = getSnapshot();
    expect(after.studentFeeItems.find((i) => i.id === first.id)?.status).toBe("paid");
    const secondAfter = after.studentFeeItems.find((i) => i.id === second.id)!;
    expect(secondAfter.paidAmount.minorUnits).toBe(100);
  });
});

describe("applyCreditToPayment", () => {
  beforeEach(() => resetDemoData());

  it("refuses to use more credit than is available", () => {
    const db = getSnapshot();
    const student = db.students[0];
    const result = applyCreditToPayment(student.id, [], moneyFromMajor(999999, "INR"), ACTOR);
    expect(result.ok).toBe(false);
  });

  it("consumes an existing credit balance to settle an item", () => {
    const item = pickUnpaidItem();
    if (!item) return;
    const due = outstandingForItem(item);
    const advance = recordPayment(baseInput({ studentId: item.studentId, itemIds: [item.id], amount: { minorUnits: due.minorUnits + 100000, currency: due.currency }, allowAdvance: true }), ACTOR);
    expect(advance.ok).toBe(true);

    const otherItem = getSnapshot().studentFeeItems.find((i) => i.studentId === item.studentId && i.id !== item.id && (i.status === "pending" || i.status === "overdue"));
    if (!otherItem) return;
    const otherDue = outstandingForItem(otherItem);
    const useAmount = otherDue.minorUnits < 100000 ? otherDue : { minorUnits: 50000, currency: otherDue.currency };
    const result = applyCreditToPayment(item.studentId, [otherItem.id], useAmount, ACTOR);
    expect(result.ok).toBe(true);

    const creditAfter = getSnapshot().creditBalances.find((c) => c.studentId === item.studentId && c.source === "overpayment")!;
    expect(creditAfter.consumedAmount.minorUnits).toBe(useAmount.minorUnits);
  });
});
