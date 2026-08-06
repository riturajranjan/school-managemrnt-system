import { describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { dailyFinanceBrief, financeExceptions } from "./finance-brief";

describe("financeExceptions", () => {
  it("returns exceptions sorted with high severity first", () => {
    resetDemoData();
    const db = getSnapshot();
    const exceptions = financeExceptions(db);
    const severityRank = { high: 0, medium: 1, low: 2 };
    for (let i = 1; i < exceptions.length; i++) {
      expect(severityRank[exceptions[i - 1].severity]).toBeLessThanOrEqual(severityRank[exceptions[i].severity]);
    }
  });

  it("every exception links somewhere actionable", () => {
    resetDemoData();
    const db = getSnapshot();
    const exceptions = financeExceptions(db);
    for (const exception of exceptions) {
      expect(exception.href.startsWith("/")).toBe(true);
    }
  });
});

describe("dailyFinanceBrief", () => {
  it("computes non-negative counts and amounts", () => {
    resetDemoData();
    const db = getSnapshot();
    const brief = dailyFinanceBrief(db);
    expect(brief.todayCollected.minorUnits).toBeGreaterThanOrEqual(0);
    expect(brief.todayExpensePaid.minorUnits).toBeGreaterThanOrEqual(0);
    expect(brief.dueThisWeek).toBeGreaterThanOrEqual(0);
    expect(brief.pendingApprovals).toBeGreaterThanOrEqual(0);
  });
});
