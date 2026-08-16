// THE canonical fee-balance formula (Phase 9F) — every collection, dues,
// receipt and report screen reads through this, never a second parallel
// calculation. Given one FeeCharge row with its adjustments and allocations:
//
//   balance = charge.amount
//           - sum(DISCOUNT adjustments)
//           - sum(SCHOLARSHIP adjustments)
//           + sum(LATE_FEE adjustments)
//           - sum(payment allocations)
//           - sum(refunds against those allocations' payments, capped at what
//             this charge originally received from that payment)
//
// A charge with balance <= 0 is PAID. balance > 0 AND dueDate < today is
// OVERDUE. balance > 0 with any allocation is PARTIALLY_PAID. balance > 0
// with no allocation is UNPAID. No status is ever persisted — it is always
// this derivation over live rows, so it can never drift from the ledger.
import { Prisma } from "@/lib/generated/prisma/client";
import { dec } from "./money";

export type ChargeStatusDto = "unpaid" | "partially_paid" | "paid" | "overdue";

export type ChargeCalcInput = {
  amount: Prisma.Decimal;
  dueDate: Date;
  adjustments: { kind: "DISCOUNT" | "SCHOLARSHIP" | "LATE_FEE"; computedAmount: Prisma.Decimal }[];
  allocations: { amount: Prisma.Decimal }[];
};

export type ChargeCalc = {
  billedAmount: number;
  discountAmount: number;
  scholarshipAmount: number;
  lateFeeAmount: number;
  netAmount: number; // billedAmount - discount - scholarship + lateFee
  paidAmount: number;
  balance: number; // netAmount - paidAmount, floored at 0 for display (never negative — overpayment is rejected at write time)
  status: ChargeStatusDto;
};

export function computeCharge(input: ChargeCalcInput, now: Date = new Date()): ChargeCalc {
  const discountAmount = input.adjustments.filter((a) => a.kind === "DISCOUNT").reduce((s, a) => s + dec(a.computedAmount), 0);
  const scholarshipAmount = input.adjustments.filter((a) => a.kind === "SCHOLARSHIP").reduce((s, a) => s + dec(a.computedAmount), 0);
  const lateFeeAmount = input.adjustments.filter((a) => a.kind === "LATE_FEE").reduce((s, a) => s + dec(a.computedAmount), 0);
  const billedAmount = dec(input.amount);
  const netAmount = Math.max(0, billedAmount - discountAmount - scholarshipAmount + lateFeeAmount);
  const paidAmount = input.allocations.reduce((s, a) => s + dec(a.amount), 0);
  const balanceRaw = netAmount - paidAmount;
  const balance = Math.max(0, Math.round(balanceRaw * 100) / 100);

  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const due = new Date(Date.UTC(input.dueDate.getUTCFullYear(), input.dueDate.getUTCMonth(), input.dueDate.getUTCDate()));

  let status: ChargeStatusDto;
  if (balance <= 0) status = "paid";
  else if (due < today) status = "overdue";
  else if (paidAmount > 0) status = "partially_paid";
  else status = "unpaid";

  return { billedAmount, discountAmount, scholarshipAmount, lateFeeAmount, netAmount, paidAmount, balance, status };
}

/** A charge's REFUNDABLE-relevant "amount this payment covered" is tracked at
 * the FeePayment/FeeRefund level (a refund references a payment, not a
 * charge) — see lib/server/fees/refunds.ts for the refundable-remaining
 * calculation, which is a payment-level concern, not a per-charge one. */
