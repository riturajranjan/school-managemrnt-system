// Platform (Super Admin) billing summary service (Phase SA-4D). Every metric is
// derived from real DB rows — subscriptions (commercial snapshots) and invoices.
// No mock data, no fabricated revenue.
//
// MRR: sum of monthly-normalized price over ACTIVE subscriptions only.
//   MONTHLY → price;  YEARLY → price / 12.
//   TRIALING, PAST_DUE, CANCELLED, ENDED are excluded (PAST_DUE is a billing
//   problem, not recognized recurring revenue).
// ARR: MRR × 12.
// OUTSTANDING: Σ amountDue over OPEN invoices. PAID amount: Σ amountPaid over PAID.
// OVERDUE: OPEN invoices with dueAt < now && amountDue > 0 (derived).
import { prisma } from "@/lib/db/prisma";
import type { BillingInterval } from "@/lib/generated/prisma/enums";

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Monthly-normalized price for one subscription (YEARLY → price/12). */
export function normalizedMonthlyPrice(price: number, interval: BillingInterval): number {
  return interval === "YEARLY" ? price / 12 : price;
}

/** Pure MRR sum over active-subscription commercial terms (deterministic/testable). */
export function computeMrr(rows: { priceAmount: number; billingInterval: BillingInterval }[]): number {
  return round2(rows.reduce((sum, r) => sum + normalizedMonthlyPrice(r.priceAmount, r.billingInterval), 0));
}

export type BillingSummary = {
  currency: string;
  activeSubscriptions: number;
  trialingSubscriptions: number;
  mrr: number;
  arr: number;
  openInvoices: number;
  overdueInvoices: number;
  outstandingAmount: number;
  paidAmount: number;
};

export async function getBillingSummary(): Promise<BillingSummary> {
  const now = new Date();

  const [activeSubs, activeSubscriptions, trialingSubscriptions, openInvoices, overdueInvoices, outstandingAgg, paidAgg] = await Promise.all([
    prisma.subscription.findMany({ where: { status: "ACTIVE" }, select: { priceAmount: true, billingInterval: true } }),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.subscription.count({ where: { status: "TRIALING" } }),
    prisma.invoice.count({ where: { status: "OPEN" } }),
    prisma.invoice.count({ where: { status: "OPEN", dueAt: { lt: now }, amountDue: { gt: 0 } } }),
    prisma.invoice.aggregate({ where: { status: "OPEN" }, _sum: { amountDue: true } }),
    prisma.invoice.aggregate({ where: { status: "PAID" }, _sum: { amountPaid: true } }),
  ]);

  const mrr = computeMrr(activeSubs.map((s) => ({ priceAmount: Number(s.priceAmount), billingInterval: s.billingInterval })));

  return {
    currency: "INR", // platform-wide reporting currency (all plans are INR in this build)
    activeSubscriptions,
    trialingSubscriptions,
    mrr,
    arr: round2(mrr * 12),
    openInvoices,
    overdueInvoices,
    outstandingAmount: round2(Number(outstandingAgg._sum.amountDue ?? 0)),
    paidAmount: round2(Number(paidAgg._sum.amountPaid ?? 0)),
  };
}
