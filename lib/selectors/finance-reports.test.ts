import { describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { payrollCostTrend, taxWithheldTrend, totalCollected } from "./finance-reports";

describe("finance-reports", () => {
  it("computes total collected as non-negative", () => {
    resetDemoData();
    const db = getSnapshot();
    expect(totalCollected(db).minorUnits).toBeGreaterThanOrEqual(0);
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
