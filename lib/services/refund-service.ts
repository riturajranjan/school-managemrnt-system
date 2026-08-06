import { getSnapshot, setState, type Db } from "@/lib/data/store";
import type { Refund, RefundMethod, RefundReason } from "@/lib/types/payments";
import { addMoney, compareMoney, isNegative, isZero, minMoney, splitEvenly, subtractMoney, sumMoney, zeroMoney, type Money } from "@/lib/finance/money";
import { generateId } from "@/lib/utils";
import { logFinancialAudit } from "./finance-audit-service";

type Actor = { name: string; role: string };

export type RequestRefundInput = { paymentId: string; amount: Money; reason: RefundReason; note?: string; method: RefundMethod };
export type RequestRefundResult = { ok: true; refund: Refund } | { ok: false; errors: string[] };

function refundableRemaining(db: Db, paymentId: string): Money {
  const payment = db.payments.find((p) => p.id === paymentId);
  if (!payment) return zeroMoney("INR");
  const alreadyRefunded = sumMoney(
    db.refunds.filter((r) => r.paymentId === paymentId && (r.status === "completed" || r.status === "processing" || r.status === "approved" || r.status === "submitted")).map((r) => r.amount),
    payment.amount.currency,
  );
  return subtractMoney(payment.amount, alreadyRefunded);
}

export function requestRefund(input: RequestRefundInput, actor: Actor): RequestRefundResult {
  const db = getSnapshot();
  const errors: string[] = [];
  const payment = db.payments.find((p) => p.id === input.paymentId);
  if (!payment) errors.push("Payment not found.");
  else if (payment.status !== "successful") errors.push(`Cannot refund a payment with status "${payment.status}".`);

  if (isNegative(input.amount) || isZero(input.amount)) errors.push("Refund amount must be greater than zero.");

  if (payment) {
    const remaining = refundableRemaining(db, input.paymentId);
    if (compareMoney(input.amount, remaining) > 0) errors.push(`Refund amount exceeds the refundable balance (${remaining.minorUnits / 100}).`);
  }

  if (errors.length > 0) return { ok: false, errors };

  const now = new Date().toISOString();
  const refund: Refund = {
    id: generateId("refund"),
    paymentId: input.paymentId,
    studentId: payment!.studentId,
    amount: input.amount,
    reason: input.reason,
    note: input.note,
    method: input.method,
    status: "submitted",
    requestedBy: actor.name,
    requestedAt: now,
  };
  setState((current) => ({ ...current, refunds: [...current.refunds, refund] }));
  logFinancialAudit({ subjectId: refund.studentId, action: "refund-requested", actorName: actor.name, actorRole: actor.role, summary: `Refund of ${input.amount.minorUnits / 100} requested (${input.reason}).` });
  return { ok: true, refund };
}

export function approveRefund(refundId: string, actor: Actor): { ok: true } | { ok: false; error: string } {
  const db = getSnapshot();
  const refund = db.refunds.find((r) => r.id === refundId);
  if (!refund) return { ok: false, error: "Refund not found." };
  if (refund.status !== "submitted") return { ok: false, error: `Cannot approve a refund in "${refund.status}" status.` };

  setState((current) => ({ ...current, refunds: current.refunds.map((r) => (r.id === refundId ? { ...r, status: "approved", approvedBy: actor.name, approvedAt: new Date().toISOString() } : r)) }));
  logFinancialAudit({ subjectId: refund.studentId, action: "refund-approved", actorName: actor.name, actorRole: actor.role, summary: `Refund of ${refund.amount.minorUnits / 100} approved.` });
  return { ok: true };
}

export function rejectRefund(refundId: string, reason: string, actor: Actor) {
  setState((db) => ({ ...db, refunds: db.refunds.map((r) => (r.id === refundId ? { ...r, status: "rejected" } : r)) }));
  const refund = getSnapshot().refunds.find((r) => r.id === refundId);
  if (refund) logFinancialAudit({ subjectId: refund.studentId, action: "refund-approved", actorName: actor.name, actorRole: actor.role, summary: `Refund rejected.`, reason });
}

/** Settles an approved refund — either as a real money movement (reversing
 * the underlying fee items' paidAmount and posting a reversal journal) or,
 * for `credit-balance`, by simply crediting the student's account with no
 * ledger movement out of the school's cash/bank. Marks the original receipt
 * refunded/partially-refunded so it's never mistaken for still fully paid. */
export function processRefund(refundId: string, actor: Actor): { ok: true } | { ok: false; error: string } {
  const db = getSnapshot();
  const refund = db.refunds.find((r) => r.id === refundId);
  if (!refund) return { ok: false, error: "Refund not found." };
  if (refund.status !== "approved") return { ok: false, error: `Cannot process a refund in "${refund.status}" status — it must be approved first.` };

  const payment = db.payments.find((p) => p.id === refund.paymentId);
  if (!payment) return { ok: false, error: "Original payment not found." };
  const allocations = db.paymentAllocations.filter((a) => a.paymentId === refund.paymentId);
  const now = new Date().toISOString();

  if (refund.method === "credit-balance") {
    setState((current) => ({
      ...current,
      refunds: current.refunds.map((r) => (r.id === refundId ? { ...r, status: "completed", processedAt: now } : r)),
      creditBalances: [...current.creditBalances, { id: generateId("credit"), studentId: refund.studentId, amount: refund.amount, consumedAmount: zeroMoney(refund.amount.currency), source: "refund" as const, note: `Refund credit for payment ${refund.paymentId}`, createdAt: now }],
    }));
    logFinancialAudit({ subjectId: refund.studentId, action: "refund-completed", actorName: actor.name, actorRole: actor.role, summary: `Refund of ${refund.amount.minorUnits / 100} issued as a credit balance.` });
    return { ok: true };
  }

  const shares = allocations.length > 0 ? splitEvenly(refund.amount, allocations.length) : [];
  const shareByItemId = new Map(allocations.map((a, i) => [a.feeItemId, shares[i]]));
  const today = new Date().toISOString().slice(0, 10);

  setState((current) => ({
    ...current,
    refunds: current.refunds.map((r) => (r.id === refundId ? { ...r, status: "completed", processedAt: now } : r)),
    studentFeeItems: current.studentFeeItems.map((item) => {
      const share = shareByItemId.get(item.id);
      if (!share) return item;
      const newPaid = subtractMoney(item.paidAmount, minMoney(share, item.paidAmount));
      const netDueTotal = addMoney(subtractMoney(item.billedAmount, addMoney(item.discountAmount, item.scholarshipAmount)), item.fineAmount);
      const newStatus: typeof item.status = isZero(newPaid) ? (item.dueDate < today ? "overdue" : "pending") : compareMoney(newPaid, netDueTotal) >= 0 ? "paid" : "partial";
      return { ...item, paidAmount: newPaid, status: newStatus };
    }),
    receipts: current.receipts.map((rcpt) => (rcpt.paymentId === refund.paymentId ? { ...rcpt, status: compareMoney(refund.amount, payment.amount) >= 0 ? "refunded" : "partially-refunded" } : rcpt)),
  }));

  logFinancialAudit({ subjectId: refund.studentId, action: "refund-completed", actorName: actor.name, actorRole: actor.role, summary: `Refund of ${refund.amount.minorUnits / 100} processed via ${refund.method}.` });
  return { ok: true };
}

export function getRefundableRemaining(paymentId: string): Money {
  return refundableRemaining(getSnapshot(), paymentId);
}
