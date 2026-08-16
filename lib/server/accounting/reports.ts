// Income/Expense reporting + Accounting Dashboard (Phase 9G) — every total
// here reads POSTED JournalLine rows only; draft/reversed journals are
// excluded by construction (the write path never leaves a POSTED line behind
// a non-POSTED entry — reversal creates a NEW entry rather than un-posting
// the original). No fake P&L/Balance Sheet: a Balance Sheet needs an opening-
// equity/current-earnings policy this product does not have yet, so it is
// intentionally NOT implemented rather than faked — see the final report's
// Deferred Items section.
import { prisma } from "@/lib/db/prisma";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { AccountingDashboardDto, IncomeExpenseReportDto } from "@/lib/api/contracts";
import { dec } from "@/lib/server/fees/money";
import { findUnbalancedPostedJournals } from "./ledger";
import { listJournalEntries } from "./journals";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");
const parseDate = (d: string) => new Date(`${d}T00:00:00.000Z`);

export const incomeExpenseReportSchema = z.object({ from: dateStr.optional(), to: dateStr.optional() });

export async function getIncomeExpenseReport(scope: OrgScope, raw: unknown): Promise<IncomeExpenseReportDto> {
  const input = parseInput(incomeExpenseReportSchema, raw);
  const dateFilter = input.from || input.to ? { entryDate: { ...(input.from ? { gte: parseDate(input.from) } : {}), ...(input.to ? { lte: parseDate(input.to) } : {}) } } : {};

  const accounts = await prisma.accountingAccount.findMany({ where: { schoolId: scope.schoolId, type: { in: ["INCOME", "EXPENSE"] } }, select: { id: true, name: true, type: true } });
  const grouped = await prisma.journalLine.groupBy({
    by: ["accountId"],
    where: { accountId: { in: accounts.map((a) => a.id) }, journalEntry: { schoolId: scope.schoolId, status: "POSTED", ...dateFilter } },
    _sum: { debit: true, credit: true },
  });
  const byAccount = new Map(grouped.map((g) => [g.accountId, { debit: dec(g._sum.debit), credit: dec(g._sum.credit) }]));

  const incomeByAccount: { accountId: string; name: string; amount: number }[] = [];
  const expenseByAccount: { accountId: string; name: string; amount: number }[] = [];
  for (const a of accounts) {
    const bal = byAccount.get(a.id);
    if (!bal) continue;
    const amount = a.type === "INCOME" ? bal.credit - bal.debit : bal.debit - bal.credit;
    if (Math.abs(amount) < 0.005) continue;
    const row = { accountId: a.id, name: a.name, amount: Math.round(amount * 100) / 100 };
    if (a.type === "INCOME") incomeByAccount.push(row);
    else expenseByAccount.push(row);
  }
  const totalIncome = Math.round(incomeByAccount.reduce((s, r) => s + r.amount, 0) * 100) / 100;
  const totalExpense = Math.round(expenseByAccount.reduce((s, r) => s + r.amount, 0) * 100) / 100;
  return { totalIncome, totalExpense, netIncome: Math.round((totalIncome - totalExpense) * 100) / 100, incomeByAccount: incomeByAccount.sort((a, b) => b.amount - a.amount), expenseByAccount: expenseByAccount.sort((a, b) => b.amount - a.amount) };
}

export async function getAccountingDashboard(scope: OrgScope): Promise<AccountingDashboardDto> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);

  const [statement, cashBankAccounts, unreconciledCount, recent, unbalanced] = await Promise.all([
    getIncomeExpenseReport(scope, { from: monthStart }),
    prisma.accountingAccount.findMany({ where: { schoolId: scope.schoolId, systemKey: { in: ["CASH", "BANK"] } }, select: { id: true } }),
    prisma.feePayment.count({ where: { schoolId: scope.schoolId, reconciliationStatus: "UNRECONCILED" } }),
    listJournalEntries(scope, { page: 1, pageSize: 5 }),
    findUnbalancedPostedJournals(scope),
  ]);

  let cashAndBankBalance = 0;
  if (cashBankAccounts.length > 0) {
    const agg = await prisma.journalLine.groupBy({ by: ["accountId"], where: { accountId: { in: cashBankAccounts.map((a) => a.id) }, journalEntry: { schoolId: scope.schoolId, status: "POSTED" } }, _sum: { debit: true, credit: true } });
    cashAndBankBalance = Math.round(agg.reduce((s, g) => s + (dec(g._sum.debit) - dec(g._sum.credit)), 0) * 100) / 100;
  }

  return {
    totalIncome: statement.totalIncome, totalExpense: statement.totalExpense, netIncome: statement.netIncome,
    cashAndBankBalance, unreconciledFeeCollections: unreconciledCount, recentJournals: recent.data, trialBalanceOk: unbalanced.length === 0,
  };
}
