import { describe, expect, it } from "vitest";
import type { Vehicle } from "@/lib/types/transport";
import { buildSeatsForVehicle } from "./vehicle-seating";

function makeVehicle(capacity: number): Vehicle {
  return {
    id: "vehicle-test",
    registrationNumber: "KA-01-TEST",
    fleetNumber: "FL-01",
    type: "bus",
    make: "Tata",
    model: "Starbus",
    year: 2023,
    capacity,
    fuelType: "diesel",
    chassisNumber: "CH-TEST",
    engineNumber: "EN-TEST",
    odometerKm: 0,
    branch: "main",
    status: "available",
    purchaseDate: "2025-01-01",
    ownershipType: "owned",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  };
}

describe("buildSeatsForVehicle", () => {
  it("generates exactly one seat per unit of capacity, all belonging to the vehicle", () => {
    const vehicle = makeVehicle(42);
    const seats = buildSeatsForVehicle(vehicle);
    expect(seats).toHaveLength(42);
    expect(seats.every((s) => s.vehicleId === vehicle.id)).toBe(true);
  });

  it("produces unique seat ids and seat numbers", () => {
    const vehicle = makeVehicle(34);
    const seats = buildSeatsForVehicle(vehicle);
    expect(new Set(seats.map((s) => s.id)).size).toBe(seats.length);
    expect(new Set(seats.map((s) => s.seatNumber)).size).toBe(seats.length);
  });

  it("designates exactly one attendant seat at the front", () => {
    const vehicle = makeVehicle(20);
    const seats = buildSeatsForVehicle(vehicle);
    const attendantSeats = seats.filter((s) => s.type === "attendant");
    expect(attendantSeats).toHaveLength(1);
    expect(attendantSeats[0].row).toBe(1);
    expect(attendantSeats[0].column).toBe(1);
  });

  it("handles a capacity that isn't a multiple of 4 without overshooting", () => {
    const vehicle = makeVehicle(15);
    const seats = buildSeatsForVehicle(vehicle);
    expect(seats).toHaveLength(15);
    expect(seats.every((s) => s.row >= 1 && s.column >= 1 && s.column <= 4)).toBe(true);
  });
});
