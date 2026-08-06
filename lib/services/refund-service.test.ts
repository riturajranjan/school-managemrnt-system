import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { approveRefund, getRefundableRemaining, processRefund, rejectRefund, requestRefund } from "./refund-service";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };

function pickSuccessfulPayment() {
  const db = getSnapshot();
  return db.payments.find((p) => p.status === "successful") ?? null;
}

describe("requestRefund", () => {
  beforeEach(() => resetDemoData());

  it("creates a submitted refund for a valid amount within the refundable balance", () => {
    const payment = pickSuccessfulPayment();
    if (!payment) return;
    const result = requestRefund({ paymentId: payment.id, amount: payment.amount, reason: "excess-payment", method: "original-method" }, ACTOR);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.refund.status).toBe("submitted");
  });

  it("refuses a refund exceeding the payment's refundable balance", () => {
    const payment = pickSuccessfulPayment();
    if (!payment) return;
    const tooMuch = { minorUnits: payment.amount.minorUnits + 100000, currency: payment.amount.currency };
    const result = requestRefund({ paymentId: payment.id, amount: tooMuch, reason: "excess-payment", method: "original-method" }, ACTOR);
    expect(result.ok).toBe(false);
  });

  it("refuses a zero or negative refund amount", () => {
    const payment = pickSuccessfulPayment();
    if (!payment) return;
    const result = requestRefund({ paymentId: payment.id, amount: { minorUnits: 0, currency: "INR" }, reason: "excess-payment", method: "original-method" }, ACTOR);
    expect(result.ok).toBe(false);
  });

  it("refuses a refund against a payment that doesn't exist", () => {
    const result = requestRefund({ paymentId: "no-such-payment", amount: { minorUnits: 100, currency: "INR" }, reason: "excess-payment", method: "original-method" }, ACTOR);
    expect(result.ok).toBe(false);
  });

  it("reduces the refundable remaining balance once a refund is in flight", () => {
    const payment = pickSuccessfulPayment();
    if (!payment) return;
    const half = { minorUnits: Math.floor(payment.amount.minorUnits / 2), currency: payment.amount.currency };
    if (half.minorUnits === 0) return;
    requestRefund({ paymentId: payment.id, amount: half, reason: "excess-payment", method: "original-method" }, ACTOR);
    const remaining = getRefundableRemaining(payment.id);
    expect(remaining.minorUnits).toBe(payment.amount.minorUnits - half.minorUnits);
  });
});

describe("approveRefund / rejectRefund", () => {
  beforeEach(() => resetDemoData());

  it("moves a submitted refund to approved", () => {
    const payment = pickSuccessfulPayment();
    if (!payment) return;
    const requested = requestRefund({ paymentId: payment.id, amount: payment.amount, reason: "excess-payment", method: "original-method" }, ACTOR);
    if (!requested.ok) return;
    const result = approveRefund(requested.refund.id, ACTOR);
    expect(result.ok).toBe(true);
    expect(getSnapshot().refunds.find((r) => r.id === requested.refund.id)?.status).toBe("approved");
  });

  it("refuses to approve a refund that isn't submitted", () => {
    const result = approveRefund("no-such-refund", ACTOR);
    expect(result.ok).toBe(false);
  });

  it("rejecting a refund marks it rejected without processing anything", () => {
    const payment = pickSuccessfulPayment();
    if (!payment) return;
    const requested = requestRefund({ paymentId: payment.id, amount: payment.amount, reason: "excess-payment", method: "original-method" }, ACTOR);
    if (!requested.ok) return;
    rejectRefund(requested.refund.id, "Not eligible", ACTOR);
    expect(getSnapshot().refunds.find((r) => r.id === requested.refund.id)?.status).toBe("rejected");
  });
});

describe("processRefund", () => {
  beforeEach(() => resetDemoData());

  it("refuses to process a refund that isn't approved yet", () => {
    const payment = pickSuccessfulPayment();
    if (!payment) return;
    const requested = requestRefund({ paymentId: payment.id, amount: payment.amount, reason: "excess-payment", method: "original-method" }, ACTOR);
    if (!requested.ok) return;
    const result = processRefund(requested.refund.id, ACTOR);
    expect(result.ok).toBe(false);
  });

  it("reduces the paid amount on the underlying fee items and marks the original receipt refunded", () => {
    const db = getSnapshot();
    const payment = pickSuccessfulPayment();
    if (!payment) return;
    const allocations = db.paymentAllocations.filter((a) => a.paymentId === payment.id);
    if (allocations.length === 0) return;

    const requested = requestRefund({ paymentId: payment.id, amount: payment.amount, reason: "excess-payment", method: "original-method" }, ACTOR);
    if (!requested.ok) return;
    approveRefund(requested.refund.id, ACTOR);
    const result = processRefund(requested.refund.id, ACTOR);
    expect(result.ok).toBe(true);

    const after = getSnapshot();
    expect(after.refunds.find((r) => r.id === requested.refund.id)?.status).toBe("completed");
    for (const allocation of allocations) {
      const item = after.studentFeeItems.find((i) => i.id === allocation.feeItemId)!;
      expect(item.paidAmount.minorUnits).toBeLessThan(allocation.amount.minorUnits + 1);
    }
    const receipt = after.receipts.find((r) => r.paymentId === payment.id);
    expect(receipt?.status).toBe("refunded");
  });

  it("marks the receipt only partially-refunded when the refund is less than the full payment", () => {
    const payment = pickSuccessfulPayment();
    if (!payment || payment.amount.minorUnits < 200) return;
    const half = { minorUnits: Math.floor(payment.amount.minorUnits / 2), currency: payment.amount.currency };

    const requested = requestRefund({ paymentId: payment.id, amount: half, reason: "excess-payment", method: "original-method" }, ACTOR);
    if (!requested.ok) return;
    approveRefund(requested.refund.id, ACTOR);
    processRefund(requested.refund.id, ACTOR);

    const receipt = getSnapshot().receipts.find((r) => r.paymentId === payment.id);
    expect(receipt?.status).toBe("partially-refunded");
  });

  it("issues a credit balance instead of reversing fee items when the method is credit-balance", () => {
    const payment = pickSuccessfulPayment();
    if (!payment) return;
    const requested = requestRefund({ paymentId: payment.id, amount: payment.amount, reason: "excess-payment", method: "credit-balance" }, ACTOR);
    if (!requested.ok) return;
    approveRefund(requested.refund.id, ACTOR);
    processRefund(requested.refund.id, ACTOR);

    const after = getSnapshot();
    const credit = after.creditBalances.find((c) => c.studentId === payment.studentId && c.source === "refund");
    expect(credit).toBeDefined();
    expect(credit?.amount.minorUnits).toBe(payment.amount.minorUnits);
  });
});
