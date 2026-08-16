// Payroll -> Accounting integration (Phase 9H). Reuses the REAL Phase 9G
// JournalEntry/JournalLine architecture exactly as Fees does — no parallel
// accounting engine, no reintroduction of the deleted mock journal-service.
// Called from INSIDE the same transaction as
// lib/server/payroll/payments.ts's recordPayrollPayment(): either the
// PayrollPayment and its accounting effect both commit, or neither does.
//
// RECOGNITION POINT (mirrors Fees' CASH basis exactly — see
// lib/server/accounting/fee-posting.ts): a JournalEntry posts only when a
// PayrollPayment is recorded, never merely on FINALIZED. One PAYROLL_EXPENSE
// system account is added (new); the existing BANK system account is reused
// for the credit side (option A from the domain scoping notes — no
// per-bank-account routing, no duplicate clearing account invented).
//
//   Debit  PAYROLL_EXPENSE = payment.amount
//   Credit BANK            = payment.amount
//
// IDEMPOTENCY: sourceEventId ("PAYROLL_PAYMENT:<id>") is DB-unique per
// school (JournalEntry.@@unique([schoolId, sourceEventId])) — the exact same
// mechanism Fees uses. Two concurrent attempts to post the same payment race
// on that constraint; the loser's insert fails with P2002 and is treated as
// an idempotent no-op, never a duplicate journal.
import { Prisma } from "@/lib/generated/prisma/client";
import type { OrgScope } from "@/lib/server/api/scope";
import { dec } from "@/lib/server/fees/money";
import { ensureSystemAccount } from "@/lib/server/accounting/accounts";
import { nextJournalEntryNumber } from "@/lib/server/accounting/entry-number";
import { resolveAccountingBranch } from "@/lib/server/accounting/access";

export async function postPayrollPaymentToAccounting(
  tx: Prisma.TransactionClient,
  scope: OrgScope,
  payment: { id: string; amount: Prisma.Decimal; paymentDate: Date },
): Promise<void> {
  const sourceEventId = `PAYROLL_PAYMENT:${payment.id}`;
  const existing = await tx.journalEntry.findUnique({ where: { schoolId_sourceEventId: { schoolId: scope.schoolId, sourceEventId } }, select: { id: true } });
  if (existing) return; // already posted — idempotent no-op

  const amount = dec(payment.amount);
  if (amount <= 0) return;

  const [payrollExpenseAccountId, bankAccountId] = await Promise.all([
    ensureSystemAccount(tx, scope, "PAYROLL_EXPENSE", "9007", "Payroll Expense", "expense"),
    ensureSystemAccount(tx, scope, "BANK", "9002", "Bank (clearing)", "asset"),
  ]);
  const branchId = await resolveAccountingBranch(scope);

  try {
    const entryNumber = await nextJournalEntryNumber(tx, scope.schoolId, payment.paymentDate.getUTCFullYear());
    await tx.journalEntry.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, academicSessionId: scope.academicSessionId,
        entryNumber, entryDate: payment.paymentDate, description: "Payroll payment", status: "POSTED",
        sourceType: "PAYROLL_PAYMENT", sourceId: payment.id, sourceEventId, createdByUserId: scope.actor.id, createdByName: scope.actor.name, postedAt: new Date(),
        lines: {
          create: [
            { accountId: payrollExpenseAccountId, debit: amount, credit: 0, description: "Payroll expense" },
            { accountId: bankAccountId, debit: 0, credit: amount, description: "Payroll disbursement" },
          ],
        },
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return; // concurrent duplicate — already posted
    throw err;
  }
}
