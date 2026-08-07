import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { addVehicleDocument, createVehicle, setVehicleStatus, updateVehicle, updateVehicleDocument } from "./vehicle-service";

const ACTOR = { name: "Transport Administrator", role: "Transport Administrator" };

function draft(overrides: Partial<Parameters<typeof createVehicle>[0]> = {}) {
  return {
    registrationNumber: "KA-05-ZZ-9999",
    fleetNumber: "BUS-99",
    type: "bus" as const,
    make: "Tata",
    model: "Starbus",
    year: 2024,
    capacity: 40,
    fuelType: "diesel" as const,
    chassisNumber: "CHTEST1",
    engineNumber: "ENTEST1",
    odometerKm: 1000,
    branch: "main",
    ownershipType: "owned" as const,
    ...overrides,
  };
}

describe("createVehicle / updateVehicle / setVehicleStatus", () => {
  beforeEach(() => resetDemoData());

  it("creates a vehicle in available status with a generated seat layout", () => {
    const result = createVehicle(draft(), ACTOR);
    expect(result.ok).toBe(true);
    if (!result.ok || !result.vehicle) return;
    expect(result.vehicle.status).toBe("available");
    const db = getSnapshot();
    expect(db.vehicles.some((v) => v.id === result.vehicle!.id)).toBe(true);
    expect(db.vehicleSeats.filter((s) => s.vehicleId === result.vehicle!.id).length).toBe(40);
  });

  it("refuses to create a vehicle with a duplicate registration number", () => {
    const db = getSnapshot();
    const existing = db.vehicles[0];
    const result = createVehicle(draft({ registrationNumber: existing.registrationNumber }), ACTOR);
    expect(result.ok).toBe(false);
  });

  it("refuses a case-insensitive duplicate registration number", () => {
    const db = getSnapshot();
    const existing = db.vehicles[0];
    const result = createVehicle(draft({ registrationNumber: existing.registrationNumber.toLowerCase() }), ACTOR);
    expect(result.ok).toBe(false);
  });

  it("updates a vehicle's fields", () => {
    const created = createVehicle(draft(), ACTOR);
    if (!created.ok || !created.vehicle) return;
    const result = updateVehicle(created.vehicle.id, { odometerKm: 5000 }, ACTOR);
    expect(result.ok).toBe(true);
    expect(getSnapshot().vehicles.find((v) => v.id === created.vehicle!.id)?.odometerKm).toBe(5000);
  });

  it("changes a vehicle's status", () => {
    const created = createVehicle(draft(), ACTOR);
    if (!created.ok || !created.vehicle) return;
    const result = setVehicleStatus(created.vehicle.id, "maintenance", ACTOR, "Scheduled service");
    expect(result.ok).toBe(true);
    expect(getSnapshot().vehicles.find((v) => v.id === created.vehicle!.id)?.status).toBe("maintenance");
  });

  it("refuses to update a non-existent vehicle", () => {
    expect(updateVehicle("no-such-vehicle", { odometerKm: 1 }, ACTOR).ok).toBe(false);
  });
});

describe("addVehicleDocument / updateVehicleDocument", () => {
  beforeEach(() => resetDemoData());

  it("adds a document and can later update its status", () => {
    const db = getSnapshot();
    const vehicle = db.vehicles[0];
    const document = addVehicleDocument({ vehicleId: vehicle.id, type: "insurance", expiryDate: "2027-01-01", status: "valid" }, ACTOR);
    expect(getSnapshot().vehicleDocuments.some((d) => d.id === document.id)).toBe(true);

    const result = updateVehicleDocument(document.id, { status: "expired" }, ACTOR);
    expect(result.ok).toBe(true);
    expect(getSnapshot().vehicleDocuments.find((d) => d.id === document.id)?.status).toBe("expired");
  });

  it("refuses to update a non-existent document", () => {
    expect(updateVehicleDocument("no-such-doc", { status: "valid" }, ACTOR).ok).toBe(false);
  });
});
