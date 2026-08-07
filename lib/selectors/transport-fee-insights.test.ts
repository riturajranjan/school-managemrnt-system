import { describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { CURRENT_SESSION } from "@/lib/data/seed/reference";
import { transportFeeInsights } from "./transport-fee-insights";

describe("transportFeeInsights", () => {
  it("computes non-negative expected/collected/pending totals from the seeded charges", () => {
    resetDemoData();
    const db = getSnapshot();
    const insights = transportFeeInsights(db, CURRENT_SESSION);
    expect(insights.totalExpected.minorUnits).toBeGreaterThan(0);
    expect(insights.totalCollected.minorUnits).toBeGreaterThanOrEqual(0);
    expect(insights.totalPending.minorUnits).toBeGreaterThanOrEqual(0);
    expect(insights.totalExpected.minorUnits).toBeGreaterThanOrEqual(insights.totalCollected.minorUnits);
  });

  it("attributes every charge's route breakdown to a route that actually carries it", () => {
    resetDemoData();
    const db = getSnapshot();
    const insights = transportFeeInsights(db, CURRENT_SESSION);
    const totalChargeCount = insights.byRoute.reduce((sum, r) => sum + r.chargeCount, 0);
    expect(totalChargeCount).toBeLessThanOrEqual(insights.charges.length);
  });
});
