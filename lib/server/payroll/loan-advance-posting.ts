// Loan/Advance -> Accounting integration (Production Payroll checkpoint).
// Reuses the REAL Phase 9G JournalEntry/JournalLine architecture exactly as
// Payroll's own postPayrollPaymentToAccounting does — no parallel accounting
// engine. Called from INSIDE the same transaction as the disbursement/
// repayment write in loans-advances.ts: either the record and its accounting
// effect both commit, or neither does.
//
// RECOGNITION POINT (mirrors Fees/Payroll's CASH basis exactly): creating or
// approving a Loan/Advance posts NOTHING. A JournalEntry posts only when a
// disbursement or a repayment is recorded — never merely on approval.
// STAFF_LOANS_RECEIVABLE / STAFF_ADVANCES_RECEIVABLE (new system accounts,
// selected by the record's `type`) pair with the existing BANK system
// account — no per-bank-account routing, no duplicate clearing account
// invented, matching Payroll's own "option A" precedent.
//
//   Disbursement: Debit  <type>_RECEIVABLE = amount
//                 Credit BANK              = amount
//   Repayment:    Debit  BANK              = amount
//                 Credit <type>_RECEIVABLE = amount
//
// IDEMPOTENCY: sourceEventId ("STAFF_ADVANCE_DISBURSED:<id>" /
// "STAFF_ADVANCE_REPAYMENT:<repaymentId>") is DB-unique per school — the
// exact same mechanism Fees/Payroll use. A concurrent duplicate attempt races
// on that constraint; the loser's insert fails with P2002 and is treated as
// an idempotent no-op, never a duplicate journal.
import { Prisma } from "@/lib/generated/prisma/client";
import type { OrgScope } from "@/lib/server/api/scope";
import { dec } from "@/lib/server/fees/money";
import { ensureSystemAccount } from "@/lib/server/accounting/accounts";
import { nextJournalEntryNumber } from "@/lib/server/accounting/entry-number";
import { resolveAccountingBranch } from "@/lib/server/accounting/access";

async function receivableAccountId(tx: Prisma.TransactionClient, scope: OrgScope, type: "LOAN" | "ADVANCE"): Promise<string> {
  return type === "LOAN"
    ? ensureSystemAccount(tx, scope, "STAFF_LOANS_RECEIVABLE", "9008", "Staff Loans Receivable", "asset")
    : ensureSystemAccount(tx, scope, "STAFF_ADVANCES_RECEIVABLE", "9009", "Staff Advances Receivable", "asset");
}

export async function postStaffAdvanceDisbursementToAccounting(
  tx: Prisma.TransactionClient,
  scope: OrgScope,
  advance: { id: string; type: "LOAN" | "ADVANCE"; amount: Prisma.Decimal; disbursementDate: Date },
): Promise<void> {
  const sourceEventId = `STAFF_ADVANCE_DISBURSED:${advance.id}`;
  const existing = await tx.journalEntry.findUnique({ where: { schoolId_sourceEventId: { schoolId: scope.schoolId, sourceEventId } }, select: { id: true } });
  if (existing) return;

  const amount = dec(advance.amount);
  if (amount <= 0) return;

  const [receivableId, bankId] = await Promise.all([receivableAccountId(tx, scope, advance.type), ensureSystemAccount(tx, scope, "BANK", "9002", "Bank (clearing)", "asset")]);
  const branchId = await resolveAccountingBranch(scope);
  const label = advance.type === "LOAN" ? "Staff loan disbursement" : "Staff advance disbursement";

  try {
    const entryNumber = await nextJournalEntryNumber(tx, scope.schoolId, advance.disbursementDate.getUTCFullYear());
    await tx.journalEntry.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, academicSessionId: scope.academicSessionId,
        entryNumber, entryDate: advance.disbursementDate, description: label, status: "POSTED",
        sourceType: "STAFF_ADVANCE_DISBURSEMENT", sourceId: advance.id, sourceEventId, createdByUserId: scope.actor.id, createdByName: scope.actor.name, postedAt: new Date(),
        lines: { create: [{ accountId: receivableId, debit: amount, credit: 0, description: label }, { accountId: bankId, debit: 0, credit: amount, description: label }] },
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return;
    throw err;
  }
}

export async function postStaffAdvanceRepaymentToAccounting(
  tx: Prisma.TransactionClient,
  scope: OrgScope,
  advance: { id: string; type: "LOAN" | "ADVANCE" },
  repayment: { id: string; amount: Prisma.Decimal; paymentDate: Date },
): Promise<void> {
  const sourceEventId = `STAFF_ADVANCE_REPAYMENT:${repayment.id}`;
  const existing = await tx.journalEntry.findUnique({ where: { schoolId_sourceEventId: { schoolId: scope.schoolId, sourceEventId } }, select: { id: true } });
  if (existing) return;

  const amount = dec(repayment.amount);
  if (amount <= 0) return;

  const [receivableId, bankId] = await Promise.all([receivableAccountId(tx, scope, advance.type), ensureSystemAccount(tx, scope, "BANK", "9002", "Bank (clearing)", "asset")]);
  const branchId = await resolveAccountingBranch(scope);
  const label = advance.type === "LOAN" ? "Staff loan repayment" : "Staff advance repayment";

  try {
    const entryNumber = await nextJournalEntryNumber(tx, scope.schoolId, repayment.paymentDate.getUTCFullYear());
    await tx.journalEntry.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, academicSessionId: scope.academicSessionId,
        entryNumber, entryDate: repayment.paymentDate, description: label, status: "POSTED",
        sourceType: "STAFF_ADVANCE_REPAYMENT", sourceId: advance.id, sourceEventId, createdByUserId: scope.actor.id, createdByName: scope.actor.name, postedAt: new Date(),
        lines: { create: [{ accountId: bankId, debit: amount, credit: 0, description: label }, { accountId: receivableId, debit: 0, credit: amount, description: label }] },
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return;
    throw err;
  }
}
