// Fees → Accounting integration (Phase 9G). Called from INSIDE the same
// transaction as lib/server/fees/payments.ts's recordFeePayment() and
// lib/server/fees/refunds.ts's createFeeRefund() — either the Fee event and
// its accounting effect both commit, or neither does. FeePayment/FeeRefund
// remain fully authoritative; this only records their accounting EFFECT.
//
// POSTING POLICY (CASH basis — see the AccountingAccount schema doc comment
// for the full rationale): for each allocation in a payment, the settled
// charge's OWN gross/discount/scholarship/lateFee composition (from
// computeCharge()) is prorated by (allocation.amount / charge.netAmount), so
// Discount/Scholarship/LateFee each land on their own real ledger line —
// never silently netted into a single "Fee Income" figure:
//
//   Debit  Cash/Bank              = payment.amount
//   Credit Fee Income             = Σ billedAmount   * ratio
//   Debit  Discounts Given        = Σ discountAmount * ratio   (contra-income; omitted if zero)
//   Debit  Scholarships Given     = Σ scholarshipAmount * ratio (contra-income; omitted if zero)
//   Credit Late Fee Income        = Σ lateFeeAmount  * ratio   (omitted if zero)
//
// This balances by construction: amount = netAmount*ratio = (billed -
// discount - scholarship + lateFee)*ratio, so
// amount + discount + scholarship == billed + lateFee (in prorated terms).
//
// A refund reads the ORIGINAL payment's journal lines (never mutates them)
// and posts a new journal with every line's debit/credit swapped and scaled
// by (refund.amount / payment.amount) — the exact mirror-and-scale strategy
// lib/server/accounting/journals.ts's reverseJournalEntry() also uses.
//
// IDEMPOTENCY: sourceEventId ("FEE_PAYMENT:<id>" / "FEE_REFUND:<id>") is
// DB-unique per school (JournalEntry.@@unique([schoolId, sourceEventId])).
// Two concurrent attempts to post the same Fee event race on that
// constraint; the loser's insert fails with P2002 and is treated as an
// idempotent no-op, never a duplicate journal.
import { Prisma } from "@/lib/generated/prisma/client";
import type { OrgScope } from "@/lib/server/api/scope";
import { computeCharge } from "@/lib/server/fees/balance";
import { dec } from "@/lib/server/fees/money";
import { ensureSystemAccount } from "./accounts";
import { nextJournalEntryNumber } from "./entry-number";
import { resolveAccountingBranch } from "./access";

const round2 = (n: number) => Math.round(n * 100) / 100;

async function systemAccounts(tx: Prisma.TransactionClient, scope: OrgScope) {
  return {
    cash: await ensureSystemAccount(tx, scope, "CASH", "9001", "Cash", "asset"),
    bank: await ensureSystemAccount(tx, scope, "BANK", "9002", "Bank (clearing)", "asset"),
    feeIncome: await ensureSystemAccount(tx, scope, "FEE_INCOME", "9003", "Fee Income", "income"),
    discountGiven: await ensureSystemAccount(tx, scope, "DISCOUNT_GIVEN", "9004", "Discounts Given", "expense"),
    scholarshipGiven: await ensureSystemAccount(tx, scope, "SCHOLARSHIP_GIVEN", "9005", "Scholarships Given", "expense"),
    lateFeeIncome: await ensureSystemAccount(tx, scope, "LATE_FEE_INCOME", "9006", "Late Fee Income", "income"),
  };
}

/** CASH covers the CASH method; every other real FeePaymentMethod (UPI/CARD/
 * BANK_TRANSFER/CHEQUE/OTHER) is manually recorded and routed to one generic
 * BANK clearing account (option A from the domain scoping notes) — never a
 * fabricated per-bank-account transaction. */
function cashOrBankKey(method: string): "cash" | "bank" {
  return method === "CASH" ? "cash" : "bank";
}

export async function postFeePaymentToAccounting(
  tx: Prisma.TransactionClient,
  scope: OrgScope,
  payment: { id: string; amount: Prisma.Decimal; method: string; paymentDate: Date; allocations: { chargeId: string; amount: Prisma.Decimal }[] },
): Promise<void> {
  const sourceEventId = `FEE_PAYMENT:${payment.id}`;
  const existing = await tx.journalEntry.findUnique({ where: { schoolId_sourceEventId: { schoolId: scope.schoolId, sourceEventId } }, select: { id: true } });
  if (existing) return; // already posted — idempotent no-op

  const charges = await tx.feeCharge.findMany({
    where: { id: { in: payment.allocations.map((a) => a.chargeId) } },
    select: { id: true, amount: true, dueDate: true, adjustments: { select: { kind: true, computedAmount: true } }, allocations: { select: { amount: true } } },
  });
  const byCharge = new Map(charges.map((c) => [c.id, c]));

  let income = 0, discount = 0, scholarship = 0, lateFee = 0;
  for (const alloc of payment.allocations) {
    const charge = byCharge.get(alloc.chargeId);
    if (!charge) continue;
    const calc = computeCharge(charge);
    if (calc.netAmount <= 0) continue;
    const ratio = dec(alloc.amount) / calc.netAmount;
    income += calc.billedAmount * ratio;
    discount += calc.discountAmount * ratio;
    scholarship += calc.scholarshipAmount * ratio;
    lateFee += calc.lateFeeAmount * ratio;
  }
  income = round2(income); discount = round2(discount); scholarship = round2(scholarship); lateFee = round2(lateFee);

  const accounts = await systemAccounts(tx, scope);
  const cashOrBankAccountId = accounts[cashOrBankKey(payment.method)];
  const branchId = await resolveAccountingBranch(scope);

  const lines: { accountId: string; debit: number; credit: number; description: string }[] = [
    { accountId: cashOrBankAccountId, debit: dec(payment.amount), credit: 0, description: "Fee payment received" },
  ];
  if (income > 0) lines.push({ accountId: accounts.feeIncome, debit: 0, credit: income, description: "Fee income" });
  if (discount > 0) lines.push({ accountId: accounts.discountGiven, debit: discount, credit: 0, description: "Discount given" });
  if (scholarship > 0) lines.push({ accountId: accounts.scholarshipGiven, debit: scholarship, credit: 0, description: "Scholarship given" });
  if (lateFee > 0) lines.push({ accountId: accounts.lateFeeIncome, debit: 0, credit: lateFee, description: "Late fee income" });

  try {
    const entryNumber = await nextJournalEntryNumber(tx, scope.schoolId, payment.paymentDate.getUTCFullYear());
    await tx.journalEntry.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, academicSessionId: scope.academicSessionId,
        entryNumber, entryDate: payment.paymentDate, description: `Fee payment`, status: "POSTED",
        sourceType: "FEE_PAYMENT", sourceId: payment.id, sourceEventId, createdByUserId: scope.actor.id, createdByName: scope.actor.name, postedAt: new Date(),
        lines: { create: lines },
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return; // concurrent duplicate — already posted
    throw err;
  }
}

export async function postFeeRefundToAccounting(
  tx: Prisma.TransactionClient,
  scope: OrgScope,
  refund: { id: string; paymentId: string; amount: Prisma.Decimal; refundedAt: Date },
): Promise<void> {
  const sourceEventId = `FEE_REFUND:${refund.id}`;
  const existing = await tx.journalEntry.findUnique({ where: { schoolId_sourceEventId: { schoolId: scope.schoolId, sourceEventId } }, select: { id: true } });
  if (existing) return;

  const originalJournal = await tx.journalEntry.findFirst({
    where: { schoolId: scope.schoolId, sourceType: "FEE_PAYMENT", sourceId: refund.paymentId },
    select: { lines: { select: { accountId: true, debit: true, credit: true, description: true } } },
  });
  const payment = await tx.feePayment.findUnique({ where: { id: refund.paymentId }, select: { amount: true } });
  if (!originalJournal || !payment || dec(payment.amount) <= 0) return; // original payment was never posted — nothing to mirror

  const ratio = dec(refund.amount) / dec(payment.amount);
  const lines = originalJournal.lines
    .map((l) => ({ accountId: l.accountId, debit: round2(dec(l.credit) * ratio), credit: round2(dec(l.debit) * ratio), description: l.description ?? "Fee refund" }))
    .filter((l) => l.debit > 0 || l.credit > 0);
  if (lines.length === 0) return;

  // The system accounts referenced by `lines` already exist — the original
  // payment's posting created them — so there is nothing to ensure here.
  const branchId = await resolveAccountingBranch(scope);

  try {
    const entryNumber = await nextJournalEntryNumber(tx, scope.schoolId, refund.refundedAt.getUTCFullYear());
    await tx.journalEntry.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, academicSessionId: scope.academicSessionId,
        entryNumber, entryDate: refund.refundedAt, description: "Fee refund", status: "POSTED",
        sourceType: "FEE_REFUND", sourceId: refund.id, sourceEventId, createdByUserId: scope.actor.id, createdByName: scope.actor.name, postedAt: new Date(),
        lines: { create: lines },
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return;
    throw err;
  }
}
