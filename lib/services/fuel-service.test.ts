import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { moneyFromMajor } from "@/lib/finance/money";
import { logFuelEntry } from "./fuel-service";

const ACTOR = { name: "Driver", role: "Driver" };

function draft(vehicleId: string, odometerKm: number) {
  return {
    vehicleId,
    date: "2026-08-06",
    odometerKm,
    quantityLitres: 40,
    fuelType: "diesel" as const,
    rate: moneyFromMajor(96, "INR"),
    totalCost: moneyFromMajor(3840, "INR"),
    vendor: "Test Pump",
    filledBy: "Test Driver",
    fullTank: true,
  };
}

describe("logFuelEntry", () => {
  beforeEach(() => resetDemoData());

  it("logs a fuel entry and advances the vehicle's odometer", () => {
    const vehicle = getSnapshot().vehicles.find((v) => v.fuelType !== "electric")!;
    const result = logFuelEntry(draft(vehicle.id, vehicle.odometerKm + 300), ACTOR);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(getSnapshot().fuelRecords.some((f) => f.id === result.record.id)).toBe(true);
    expect(getSnapshot().vehicles.find((v) => v.id === vehicle.id)?.odometerKm).toBe(vehicle.odometerKm + 300);
  });

  it("refuses an entry for a non-existent vehicle", () => {
    const result = logFuelEntry(draft("no-such-vehicle", 1000), ACTOR);
    expect(result.ok).toBe(false);
  });

  it("refuses a zero or negative quantity", () => {
    const vehicle = getSnapshot().vehicles.find((v) => v.fuelType !== "electric")!;
    const result = logFuelEntry({ ...draft(vehicle.id, vehicle.odometerKm + 100), quantityLitres: 0 }, ACTOR);
    expect(result.ok).toBe(false);
  });

  it("refuses an odometer reading behind the vehicle's last recorded reading", () => {
    const vehicle = getSnapshot().vehicles.find((v) => v.fuelType !== "electric")!;
    const result = logFuelEntry(draft(vehicle.id, vehicle.odometerKm - 50), ACTOR);
    expect(result.ok).toBe(false);
  });
});
