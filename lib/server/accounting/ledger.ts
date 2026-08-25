// General Ledger + Trial Balance (Phase 9G) — fully server-derived from
// POSTED JournalLine rows only. Ordering is deterministic (entryDate ASC,
// createdAt ASC, id ASC) so a running balance replay can never be ambiguous.
// The frontend never reconstructs a balance independently.
import { prisma } from "@/lib/db/prisma";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { AccountLedgerDto, JournalSourceTypeDto, LedgerEntryDto, TrialBalanceDto } from "@/lib/api/contracts";
import { dec } from "@/lib/server/fees/money";
import { getAccountingAccount } from "./accounts";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");
const parseDate = (d: string) => new Date(`${d}T00:00:00.000Z`);
const dateToUi = (d: Date) => d.toISOString().slice(0, 10);
const SOURCE_TO_UI: Record<string, JournalSourceTypeDto> = {
  MANUAL: "manual", FEE_PAYMENT: "fee_payment", FEE_REFUND: "fee_refund", PAYROLL_PAYMENT: "payroll_payment",
  STAFF_ADVANCE_DISBURSEMENT: "staff_advance_disbursement", STAFF_ADVANCE_REPAYMENT: "staff_advance_repayment",
};

function normalBalance(type: string, debit: number, credit: number): number {
  return type === "ASSET" || type === "EXPENSE" ? debit - credit : credit - debit;
}

export const getAccountLedgerSchema = z.object({ from: dateStr.optional(), to: dateStr.optional() });

export async function getAccountLedger(scope: OrgScope, accountId: string, raw: unknown): Promise<AccountLedgerDto> {
  const input = parseInput(getAccountLedgerSchema, raw);
  const account = await getAccountingAccount(scope, accountId);

  const fromDate = input.from ? parseDate(input.from) : null;
  const toDate = input.to ? parseDate(input.to) : null;

  // Opening balance: every POSTED line on this account strictly before `from`.
  let openingBalance = 0;
  if (fromDate) {
    const priorAgg = await prisma.journalLine.aggregate({
      where: { accountId, journalEntry: { schoolId: scope.schoolId, status: "POSTED", entryDate: { lt: fromDate } } },
      _sum: { debit: true, credit: true },
    });
    openingBalance = normalBalance(accountTypeToDb(account.type), dec(priorAgg._sum.debit), dec(priorAgg._sum.credit));
  }

  const lines = await prisma.journalLine.findMany({
    where: {
      accountId,
      journalEntry: { schoolId: scope.schoolId, status: "POSTED", ...(fromDate || toDate ? { entryDate: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } } : {}) },
    },
    orderBy: [{ journalEntry: { entryDate: "asc" } }, { journalEntry: { createdAt: "asc" } }, { id: "asc" }],
    select: { id: true, debit: true, credit: true, journalEntry: { select: { id: true, entryNumber: true, entryDate: true, description: true, sourceType: true } } },
  });

  let running = openingBalance;
  const isDebitNormal = accountTypeToDb(account.type) === "ASSET" || accountTypeToDb(account.type) === "EXPENSE";
  const entries: LedgerEntryDto[] = lines.map((l) => {
    const d = dec(l.debit), c = dec(l.credit);
    running += isDebitNormal ? d - c : c - d;
    return {
      id: l.id, journalEntryId: l.journalEntry.id, entryNumber: l.journalEntry.entryNumber, entryDate: dateToUi(l.journalEntry.entryDate),
      description: l.journalEntry.description, sourceType: SOURCE_TO_UI[l.journalEntry.sourceType], debit: d, credit: c, runningBalance: Math.round(running * 100) / 100,
    };
  });

  return { account, openingBalance: Math.round(openingBalance * 100) / 100, entries, closingBalance: Math.round(running * 100) / 100 };
}

function accountTypeToDb(t: string): string {
  return t.toUpperCase();
}

export const trialBalanceSchema = z.object({ asOf: dateStr.optional() });

export async function getTrialBalance(scope: OrgScope, raw: unknown): Promise<TrialBalanceDto> {
  const input = parseInput(trialBalanceSchema, raw);
  const asOf = input.asOf ? parseDate(input.asOf) : null;

  const accounts = await prisma.accountingAccount.findMany({ where: { schoolId: scope.schoolId }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true, type: true } });
  const grouped = await prisma.journalLine.groupBy({
    by: ["accountId"],
    where: { journalEntry: { schoolId: scope.schoolId, status: "POSTED", ...(asOf ? { entryDate: { lte: asOf } } : {}) } },
    _sum: { debit: true, credit: true },
  });
  const byAccount = new Map(grouped.map((g) => [g.accountId, { debit: dec(g._sum.debit), credit: dec(g._sum.credit) }]));

  const rows = accounts
    .map((a) => {
      const bal = byAccount.get(a.id);
      if (!bal) return null;
      const balance = Math.round(normalBalance(a.type, bal.debit, bal.credit) * 100) / 100;
      return { accountId: a.id, code: a.code, name: a.name, type: a.type.toLowerCase() as never, debit: Math.round(bal.debit * 100) / 100, credit: Math.round(bal.credit * 100) / 100, balance };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  const totalDebit = Math.round(rows.reduce((s, r) => s + r.debit, 0) * 100) / 100;
  const totalCredit = Math.round(rows.reduce((s, r) => s + r.credit, 0) * 100) / 100;
  return { rows, totalDebit, totalCredit, balanced: Math.abs(totalDebit - totalCredit) < 0.005 };
}

/** Scans for any POSTED journal whose lines don't balance — should always be
 * empty (createAndPostJournalEntry/fee-posting both enforce balance before
 * POSTED is ever written), but this is the direct integrity check the spec
 * calls for, independent of the write path. */
export async function findUnbalancedPostedJournals(scope: OrgScope): Promise<{ id: string; entryNumber: string; totalDebit: number; totalCredit: number }[]> {
  const entries = await prisma.journalEntry.findMany({ where: { schoolId: scope.schoolId, status: "POSTED" }, select: { id: true, entryNumber: true, lines: { select: { debit: true, credit: true } } } });
  return entries
    .map((e) => {
      const totalDebit = Math.round(e.lines.reduce((s, l) => s + dec(l.debit), 0) * 100) / 100;
      const totalCredit = Math.round(e.lines.reduce((s, l) => s + dec(l.credit), 0) * 100) / 100;
      return { id: e.id, entryNumber: e.entryNumber, totalDebit, totalCredit };
    })
    .filter((e) => Math.abs(e.totalDebit - e.totalCredit) >= 0.005);
}
