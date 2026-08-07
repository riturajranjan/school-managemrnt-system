import { describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { computeTransportPulse } from "./transport-pulse";

describe("computeTransportPulse", () => {
  it("computes a score in [0, 100] as the average of its own factors", () => {
    resetDemoData();
    const db = getSnapshot();
    const pulse = computeTransportPulse(db);
    expect(pulse.score).toBeGreaterThanOrEqual(0);
    expect(pulse.score).toBeLessThanOrEqual(100);
    const expectedAverage = Math.round(pulse.factors.reduce((sum, f) => sum + f.score, 0) / pulse.factors.length);
    expect(pulse.score).toBe(expectedAverage);
  });

  it("keeps every factor's score within [0, 100]", () => {
    resetDemoData();
    const db = getSnapshot();
    const pulse = computeTransportPulse(db);
    for (const factor of pulse.factors) {
      expect(factor.score).toBeGreaterThanOrEqual(0);
      expect(factor.score).toBeLessThanOrEqual(100);
    }
  });
});
