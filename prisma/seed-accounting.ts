// Phase 9G seed — real AccountingAccount rows (Cash/Bank/Fee Income/etc. plus
// one example Expense account), a real backfilled JournalEntry for the
// FeePayment seed-fees.ts creates directly via prisma (before the Phase 9G
// accounting integration existed, so it predates any automatic posting), and
// one real manual journal entry (an office-supplies expense) so the demo has
// something to walk through on the Ledger/Trial Balance/Reports pages.
// Idempotent (sourceEventId / code / description checks before every write).
import type { PrismaClient } from "../lib/generated/prisma/client";
import { ensureSystemAccount } from "../lib/server/accounting/accounts";
import { createAndPostJournalEntry } from "../lib/server/accounting/journals";
import { postFeePaymentToAccounting } from "../lib/server/accounting/fee-posting";
import type { OrgScope } from "../lib/server/api/scope";

type Ids = { tenantId: string; schoolId: string; branchId: string; academicSessionId: string };

export async function seedAccounting(prisma: PrismaClient, ids: Ids) {
  const { tenantId, schoolId, branchId, academicSessionId } = ids;

  const admin = await prisma.roleAssignment.findFirst({
    where: { role: { key: "SCHOOL_ADMIN" }, membership: { tenantId, status: "ACTIVE" } },
    select: { membership: { select: { userId: true } } },
  });
  if (!admin) {
    console.log("  P9G:      skipped (no real SCHOOL_ADMIN yet)");
    return;
  }
  const scope: OrgScope = { tenantId, schoolId, branchId, academicSessionId, actor: { id: admin.membership.userId, name: "School Admin" } };

  // Backfill: the FeePayment seed-fees.ts creates via a direct prisma.feePayment.create
  // (predates the Phase 9G automatic-posting integration) has no journal yet.
  let backfilled = 0;
  const [allPayments, postedSourceIds] = await Promise.all([
    prisma.feePayment.findMany({ where: { schoolId }, select: { id: true, amount: true, method: true, paymentDate: true, allocations: { select: { chargeId: true, amount: true } } } }),
    prisma.journalEntry.findMany({ where: { schoolId, sourceType: "FEE_PAYMENT" }, select: { sourceId: true } }),
  ]);
  const postedIds = new Set(postedSourceIds.map((r) => r.sourceId));
  const unpostedPayments = allPayments.filter((p) => !postedIds.has(p.id));
  for (const payment of unpostedPayments) {
    await prisma.$transaction((tx) =>
      postFeePaymentToAccounting(tx, scope, {
        id: payment.id, amount: payment.amount, method: payment.method, paymentDate: payment.paymentDate,
        allocations: payment.allocations.map((a) => ({ chargeId: a.chargeId, amount: a.amount })),
      }),
    );
    backfilled++;
  }

  // One example manual journal (an office-supplies expense) so Income/Expense
  // quick-entry, Ledger and Trial Balance all have something real to show.
  const MANUAL_DESC = "Office Supplies Purchase";
  const existingManual = await prisma.journalEntry.findFirst({ where: { schoolId, sourceType: "MANUAL", description: MANUAL_DESC }, select: { id: true } });
  let manualPosted = 0;
  if (!existingManual) {
    const cashAccountId = await prisma.$transaction((tx) => ensureSystemAccount(tx, scope, "CASH", "9001", "Cash", "asset"));
    let expenseAccount = await prisma.accountingAccount.findFirst({ where: { schoolId, code: "5001" }, select: { id: true } });
    if (!expenseAccount) {
      expenseAccount = await prisma.accountingAccount.create({
        data: { tenantId, schoolId, branchId, code: "5001", name: "Office Supplies", type: "EXPENSE" },
        select: { id: true },
      });
    }
    await createAndPostJournalEntry(scope, {
      entryDate: "2026-06-15",
      description: MANUAL_DESC,
      lines: [
        { accountId: expenseAccount.id, debit: 1500 },
        { accountId: cashAccountId, credit: 1500 },
      ],
    });
    manualPosted = 1;
  }

  console.log(`  P9G:      backfilled fee-payment journals(+${backfilled}) manual journal(+${manualPosted})`);
}
