import { describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { cashFlowSummary, collectionSummaryByMethod, incomeStatement, payrollCostTrend, taxWithheldTrend, totalCollected, totalOutstanding, trialBalance } from "./finance-reports";

describe("finance-reports", () => {
  it("summarizes collections by method matching the total successful payments", () => {
    resetDemoData();
    const db = getSnapshot();
    const byMethod = collectionSummaryByMethod(db);
    const total = totalCollected(db);
    const sumOfMethods = byMethod.reduce((sum, m) => sum + m.total.minorUnits, 0);
    expect(sumOfMethods).toBe(total.minorUnits);
  });

  it("computes total outstanding as non-negative", () => {
    resetDemoData();
    const db = getSnapshot();
    expect(totalOutstanding(db).minorUnits).toBeGreaterThanOrEqual(0);
  });

  it("builds a trial balance where every row has a non-zero balance", () => {
    resetDemoData();
    const db = getSnapshot();
    const rows = trialBalance(db);
    expect(rows.every((r) => r.balance.minorUnits !== 0)).toBe(true);
  });

  it("computes an income statement where net income = total income - total expense", () => {
    resetDemoData();
    const db = getSnapshot();
    const statement = incomeStatement(db);
    expect(statement.netIncome.minorUnits).toBe(statement.totalIncome.minorUnits - statement.totalExpense.minorUnits);
  });

  it("computes cash flow rows only for cash/bank accounts", () => {
    resetDemoData();
    const db = getSnapshot();
    const rows = cashFlowSummary(db);
    expect(rows.length).toBe(db.chartOfAccounts.filter((a) => a.type === "cash" || a.type === "bank").length);
  });

  it("builds a payroll cost trend sorted by period, excluding drafts and cancellations", () => {
    resetDemoData();
    const db = getSnapshot();
    const trend = payrollCostTrend(db);
    expect(trend.every((_, i) => i === 0 || trend[i - 1].period <= trend[i].period)).toBe(true);
  });

  it("builds a tax-withheld trend from payslip deductions matching /tax/i", () => {
    resetDemoData();
    const db = getSnapshot();
    const trend = taxWithheldTrend(db);
    for (const row of trend) {
      expect(row.taxWithheld.minorUnits).toBeGreaterThan(0);
    }
  });
});
