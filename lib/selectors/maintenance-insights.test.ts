import { describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { maintenanceInsights } from "./maintenance-insights";

describe("maintenanceInsights", () => {
  it("flags the seeded overdue record and vehicle-under-maintenance", () => {
    resetDemoData();
    const db = getSnapshot();
    const insights = maintenanceInsights(db);
    expect(insights.overdue.length).toBeGreaterThan(0);
    expect(insights.vehiclesUnavailable.length).toBeGreaterThan(0);
  });

  it("computes non-negative estimated and actual cost totals", () => {
    resetDemoData();
    const db = getSnapshot();
    const insights = maintenanceInsights(db);
    expect(insights.estimatedCost.minorUnits).toBeGreaterThanOrEqual(0);
    expect(insights.actualCost.minorUnits).toBeGreaterThanOrEqual(0);
  });

  it("only flags a vehicle as a repeat-breakdown case when it has more than one breakdown-repair record", () => {
    resetDemoData();
    const db = getSnapshot();
    const insights = maintenanceInsights(db);
    for (const { vehicleId } of insights.repeatBreakdownVehicles) {
      const count = db.maintenanceRecords.filter((m) => m.vehicleId === vehicleId && m.type === "breakdown-repair").length;
      expect(count).toBeGreaterThan(1);
    }
  });
});
