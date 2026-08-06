import type { Db } from "@/lib/data/store";
import type { PaymentMethod } from "@/lib/types/payments";
import { addMoney, sumMoney, zeroMoney, type Money } from "@/lib/finance/money";
import { accountBalance } from "./ledger";
import { totalOutstanding as feeItemsTotalOutstanding } from "./fee-item-insights";

// ---------------------------------------------------------------------------
// Fee reports
// ---------------------------------------------------------------------------

export type CollectionByMethod = { method: PaymentMethod; total: Money; count: number };

export function collectionSummaryByMethod(db: Db): CollectionByMethod[] {
  const successful = db.payments.filter((p) => p.status === "successful");
  const methods = Array.from(new Set(successful.map((p) => p.method)));
  return methods
    .map((method) => {
      const rows = successful.filter((p) => p.method === method);
      return { method, total: sumMoney(rows.map((p) => p.amount), "INR"), count: rows.length };
    })
    .sort((a, b) => b.total.minorUnits - a.total.minorUnits);
}

export function totalCollected(db: Db): Money {
  return sumMoney(
    db.payments.filter((p) => p.status === "successful").map((p) => p.amount),
    "INR",
  );
}

export function totalOutstanding(db: Db): Money {
  return feeItemsTotalOutstanding(db.studentFeeItems);
}

export function waiverSummary(db: Db): { discounts: Money; scholarships: Money; concessions: Money } {
  return {
    discounts: sumMoney(
      db.discounts.filter((d) => d.status === "active").map((d) => d.amount ?? zeroMoney("INR")),
      "INR",
    ),
    scholarships: sumMoney(
      db.scholarships.filter((s) => s.status === "active").map((s) => s.amount ?? zeroMoney("INR")),
      "INR",
    ),
    concessions: sumMoney(
      db.concessions.filter((c) => c.status === "active").map((c) => c.amount ?? zeroMoney("INR")),
      "INR",
    ),
  };
}

// ---------------------------------------------------------------------------
// Accounting reports
// ---------------------------------------------------------------------------

export type TrialBalanceRow = { accountId: string; code: string; name: string; type: string; balance: Money };

export function trialBalance(db: Db): TrialBalanceRow[] {
  return db.chartOfAccounts
    .map((account) => ({ accountId: account.id, code: account.code, name: account.name, type: account.type, balance: accountBalance(db.ledgerEntries, account.id) }))
    .filter((row) => row.balance.minorUnits !== 0)
    .sort((a, b) => a.code.localeCompare(b.code));
}

export type IncomeStatement = { totalIncome: Money; totalExpense: Money; netIncome: Money; incomeByAccount: { name: string; amount: Money }[]; expenseByAccount: { name: string; amount: Money }[] };

export function incomeStatement(db: Db): IncomeStatement {
  const incomeAccounts = db.chartOfAccounts.filter((a) => a.type === "income");
  const expenseAccounts = db.chartOfAccounts.filter((a) => a.type === "expense");

  const incomeByAccount = incomeAccounts.map((a) => ({ name: a.name, amount: accountBalance(db.ledgerEntries, a.id) })).filter((r) => r.amount.minorUnits !== 0);
  const expenseByAccount = expenseAccounts.map((a) => ({ name: a.name, amount: accountBalance(db.ledgerEntries, a.id) })).filter((r) => r.amount.minorUnits !== 0);

  const totalIncome = sumMoney(
    incomeByAccount.map((r) => r.amount),
    "INR",
  );
  const totalExpense = sumMoney(
    expenseByAccount.map((r) => r.amount),
    "INR",
  );
  return { totalIncome, totalExpense, netIncome: { minorUnits: totalIncome.minorUnits - totalExpense.minorUnits, currency: "INR" }, incomeByAccount, expenseByAccount };
}

export type CashFlowRow = { accountId: string; name: string; inflow: Money; outflow: Money };

export function cashFlowSummary(db: Db): CashFlowRow[] {
  const cashAndBankAccounts = db.chartOfAccounts.filter((a) => a.type === "cash" || a.type === "bank");
  return cashAndBankAccounts.map((account) => {
    const entries = db.ledgerEntries.filter((l) => l.ledgerRefId === account.id);
    return { accountId: account.id, name: account.name, inflow: sumMoney(entries.map((e) => e.debit), "INR"), outflow: sumMoney(entries.map((e) => e.credit), "INR") };
  });
}

// ---------------------------------------------------------------------------
// Payroll reports
// ---------------------------------------------------------------------------

export type PayrollCostByPeriod = { period: string; totalGross: Money; totalDeductions: Money; totalNet: Money; employeeCount: number };

export function payrollCostTrend(db: Db): PayrollCostByPeriod[] {
  return [...db.payrollRuns]
    .filter((r) => r.status !== "cancelled" && r.status !== "draft")
    .sort((a, b) => (a.period < b.period ? -1 : 1))
    .map((r) => ({ period: r.period, totalGross: r.totalGross, totalDeductions: r.totalDeductions, totalNet: r.totalNet, employeeCount: r.employees.length }));
}

export type TaxWithheldByPeriod = { period: string; taxWithheld: Money; employeeCount: number };

export function taxWithheldTrend(db: Db): TaxWithheldByPeriod[] {
  const byPeriod = new Map<string, { taxWithheld: Money; employeeCount: number }>();
  for (const payslip of db.payslips) {
    const taxLines = payslip.deductions.filter((d) => /tax/i.test(d.label));
    if (taxLines.length === 0) continue;
    const taxAmount = sumMoney(
      taxLines.map((d) => d.amount),
      "INR",
    );
    const existing = byPeriod.get(payslip.period) ?? { taxWithheld: zeroMoney("INR"), employeeCount: 0 };
    byPeriod.set(payslip.period, { taxWithheld: addMoney(existing.taxWithheld, taxAmount), employeeCount: existing.employeeCount + 1 });
  }
  return Array.from(byPeriod.entries())
    .map(([period, v]) => ({ period, ...v }))
    .sort((a, b) => (a.period < b.period ? -1 : 1));
}
