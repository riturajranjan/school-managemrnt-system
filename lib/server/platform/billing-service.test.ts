// Pure billing-math tests (Super Admin SA-4D). Deterministic, no DB — verifies
// the MRR/ARR money formulas independent of parallel DB state.
import { describe, expect, it } from "vitest";
import { computeMrr, normalizedMonthlyPrice, round2 } from "@/lib/server/platform/billing-service";

describe("billing math", () => {
  it("normalizes yearly price to a monthly figure (÷12)", () => {
    expect(normalizedMonthlyPrice(1200, "MONTHLY")).toBe(1200);
    expect(normalizedMonthlyPrice(12000, "YEARLY")).toBe(1000);
  });

  it("computes MRR across mixed intervals (ACTIVE snapshots)", () => {
    const mrr = computeMrr([
      { priceAmount: 9999, billingInterval: "MONTHLY" },
      { priceAmount: 12000, billingInterval: "YEARLY" }, // → 1000/mo
      { priceAmount: 4999, billingInterval: "MONTHLY" },
    ]);
    expect(mrr).toBe(round2(9999 + 1000 + 4999));
    // ARR is exactly MRR × 12.
    expect(round2(mrr * 12)).toBe(round2((9999 + 1000 + 4999) * 12));
  });

  it("is zero for an empty set", () => {
    expect(computeMrr([])).toBe(0);
  });

  it("rounds to 2 decimal places (no float drift authority)", () => {
    // 999.99 / 12 = 83.3325 → 83.33
    expect(computeMrr([{ priceAmount: 999.99, billingInterval: "YEARLY" }])).toBe(83.33);
  });
});
