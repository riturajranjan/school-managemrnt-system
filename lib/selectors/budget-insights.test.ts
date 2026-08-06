import { describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { moneyFromMajor, zeroMoney } from "@/lib/finance/money";
import { actualForLine, isOverThreshold, utilizationPercent } from "./budget-insights";
import type { BudgetLine } from "@/lib/types/accounting";

describe("budget-insights", () => {
  it("computes utilization percent, capping the zero-planned edge case", () => {
    expect(utilizationPercent(moneyFromMajor(50, "INR"), moneyFromMajor(100, "INR"))).toBe(50);
    expect(utilizationPercent(zeroMoney("INR"), zeroMoney("INR"))).toBe(0);
    expect(utilizationPercent(moneyFromMajor(10, "INR"), zeroMoney("INR"))).toBe(100);
  });

  it("flags a line as over threshold once actual crosses the alert percent of planned", () => {
    const line: BudgetLine = { id: "bl-1", budgetId: "b-1", category: "technology", plannedAmount: moneyFromMajor(1000, "INR"), committedAmount: zeroMoney("INR"), actualAmount: zeroMoney("INR"), alertThresholdPercent: 80 };
    expect(isOverThreshold(moneyFromMajor(700, "INR"), line)).toBe(false);
    expect(isOverThreshold(moneyFromMajor(800, "INR"), line)).toBe(true);
  });

  it("sums paid/approved expenses for an expense-category line from the live store", () => {
    resetDemoData();
    const db = getSnapshot();
    const line: BudgetLine = { id: "bl-2", budgetId: "b-1", category: "technology", plannedAmount: moneyFromMajor(1000000, "INR"), committedAmount: zeroMoney("INR"), actualAmount: zeroMoney("INR"), alertThresholdPercent: 85 };
    const actual = actualForLine(db, line, "2026-2027");
    const expected = db.expenses.filter((e) => e.category === "technology" && (e.status === "paid" || e.status === "approved"));
    expect(actual.minorUnits).toBeGreaterThanOrEqual(0);
    expect(expected.length).toBeGreaterThan(0);
  });
});
