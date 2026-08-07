import { describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { fuelEfficiencyByVehicle, fuelInsights } from "./fuel-insights";

describe("fuelEfficiencyByVehicle", () => {
  it("derives kmpl from consecutive odometer deltas, never trusting a stored figure", () => {
    resetDemoData();
    const db = getSnapshot();
    const vehicle = db.fuelRecords[0]?.vehicleId;
    if (!vehicle) return;
    const points = fuelEfficiencyByVehicle(db, vehicle);
    for (const p of points) {
      expect(p.kmpl).toBeCloseTo(p.kmSinceLast / p.litres);
      expect(p.kmSinceLast).toBeGreaterThan(0);
    }
  });
});

describe("fuelInsights", () => {
  it("computes non-negative month-to-date totals", () => {
    resetDemoData();
    const db = getSnapshot();
    const insights = fuelInsights(db);
    expect(insights.totalCostThisMonth.minorUnits).toBeGreaterThanOrEqual(0);
    expect(insights.totalLitresThisMonth).toBeGreaterThanOrEqual(0);
  });

  it("only flags an anomaly when it falls well below that vehicle's own average", () => {
    resetDemoData();
    const db = getSnapshot();
    const insights = fuelInsights(db);
    for (const anomaly of insights.anomalies) {
      expect(anomaly.kmpl).toBeLessThan(anomaly.expectedKmpl * 0.7);
    }
  });
});
