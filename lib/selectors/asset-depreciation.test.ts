import { describe, expect, it } from "vitest";
import { accumulatedDepreciation, bookValueAfter, periodsElapsed } from "./asset-depreciation";
import { moneyFromMajor, toMajorUnits } from "@/lib/finance/money";

describe("straight-line depreciation", () => {
  const cost = moneyFromMajor(50000, "INR");
  const salvage = moneyFromMajor(5000, "INR");

  it("depreciates evenly over the useful life", () => {
    // (50000 - 5000) / 5 = 9000/year
    expect(toMajorUnits(bookValueAfter(cost, salvage, 5, "straight-line", 1))).toBe(41000);
    expect(toMajorUnits(bookValueAfter(cost, salvage, 5, "straight-line", 3))).toBe(23000);
  });

  it("never depreciates below salvage value at end of life", () => {
    expect(toMajorUnits(bookValueAfter(cost, salvage, 5, "straight-line", 5))).toBe(5000);
    expect(toMajorUnits(bookValueAfter(cost, salvage, 5, "straight-line", 10))).toBe(5000);
  });

  it("computes accumulated depreciation as cost minus book value", () => {
    expect(toMajorUnits(accumulatedDepreciation(cost, salvage, 5, "straight-line", 2))).toBe(18000);
  });
});

describe("declining-balance depreciation", () => {
  const cost = moneyFromMajor(40000, "INR");
  const salvage = moneyFromMajor(4000, "INR");

  it("front-loads depreciation and stays above salvage", () => {
    const y1 = toMajorUnits(bookValueAfter(cost, salvage, 4, "declining-balance", 1)); // rate = 0.5 → 20000
    expect(y1).toBe(20000);
    const y10 = toMajorUnits(bookValueAfter(cost, salvage, 4, "declining-balance", 10));
    expect(y10).toBeGreaterThanOrEqual(4000);
  });
});

describe("no depreciation", () => {
  it("keeps book value at cost", () => {
    const cost = moneyFromMajor(10000, "INR");
    expect(toMajorUnits(bookValueAfter(cost, moneyFromMajor(0, "INR"), 5, "none", 3))).toBe(10000);
  });
});

describe("periodsElapsed", () => {
  it("counts whole years since the start date", () => {
    expect(periodsElapsed("2023-08-05", "2026-08-05")).toBe(3);
    expect(periodsElapsed("2026-01-01", "2026-08-05")).toBe(0);
  });
});
