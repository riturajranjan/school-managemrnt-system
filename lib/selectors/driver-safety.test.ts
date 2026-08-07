import { describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { computeDriverSafety } from "./driver-safety";

describe("computeDriverSafety", () => {
  it("produces a score within [0, 100] from four weighted components with an explanation", () => {
    resetDemoData();
    const db = getSnapshot();
    for (const driver of db.drivers) {
      const safety = computeDriverSafety(db, driver);
      expect(safety.score).toBeGreaterThanOrEqual(0);
      expect(safety.score).toBeLessThanOrEqual(100);
      expect(safety.components).toHaveLength(4);
      expect(safety.explanation.length).toBeGreaterThan(0);
      const totalWeight = safety.components.reduce((sum, c) => sum + c.weight, 0);
      expect(totalWeight).toBeCloseTo(1, 5);
    }
  });

  it("scores on-time performance as perfect for a driver with no delayed trips", () => {
    resetDemoData();
    const db = getSnapshot();
    const driver = db.drivers.find((d) => !db.transportTrips.some((t) => t.driverId === d.id && t.status === "delayed"));
    if (!driver) return;
    const safety = computeDriverSafety(db, driver);
    const onTime = safety.components.find((c) => c.key === "on-time")!;
    expect(onTime.value).toBe(100);
  });

  it("lowers the on-time component for a driver whose trip was delayed", () => {
    resetDemoData();
    const db = getSnapshot();
    const delayedTrip = db.transportTrips.find((t) => t.status === "delayed");
    if (!delayedTrip) return;
    const driver = db.drivers.find((d) => d.id === delayedTrip.driverId)!;
    const safety = computeDriverSafety(db, driver);
    const onTime = safety.components.find((c) => c.key === "on-time")!;
    expect(onTime.value).toBeLessThan(100);
  });
});
