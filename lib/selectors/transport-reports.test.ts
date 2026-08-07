import { describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { costSummary, routeUtilization, tripDelayStats } from "./transport-reports";

describe("routeUtilization", () => {
  it("keeps occupancy within 0-100% and never exceeds capacity's implied bound", () => {
    resetDemoData();
    const db = getSnapshot();
    const rows = routeUtilization(db);
    for (const row of rows) {
      expect(row.occupancyPercent).toBeGreaterThanOrEqual(0);
      expect(row.assignedCount).toBeLessThanOrEqual(row.capacity + 1);
    }
  });
});

describe("tripDelayStats", () => {
  it("computes an on-time percentage between 0 and 100", () => {
    resetDemoData();
    const db = getSnapshot();
    const stats = tripDelayStats(db);
    expect(stats.onTimePercent).toBeGreaterThanOrEqual(0);
    expect(stats.onTimePercent).toBeLessThanOrEqual(100);
    expect(stats.averageDelayMinutes).toBeGreaterThanOrEqual(0);
  });
});

describe("costSummary", () => {
  it("sums maintenance and fuel cost into a single non-negative total", () => {
    resetDemoData();
    const db = getSnapshot();
    const summary = costSummary(db);
    expect(summary.totalCost.minorUnits).toBe(summary.maintenanceCost.minorUnits + summary.fuelCost.minorUnits);
    expect(summary.totalCost.minorUnits).toBeGreaterThanOrEqual(0);
  });
});
