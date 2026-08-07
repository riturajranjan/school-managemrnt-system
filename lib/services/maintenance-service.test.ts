import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { moneyFromMajor, zeroMoney } from "@/lib/finance/money";
import { addMaintenancePart, completeMaintenance, scheduleMaintenance, setMaintenanceStatus } from "./maintenance-service";

const ACTOR = { name: "Mechanic", role: "Mechanic" };

function draft(vehicleId: string) {
  return { vehicleId, type: "routine-service" as const, scheduledDate: "2026-09-01", vendor: "Test Garage", cost: zeroMoney("INR"), labourCost: zeroMoney("INR"), parts: [] };
}

describe("scheduleMaintenance / setMaintenanceStatus", () => {
  beforeEach(() => resetDemoData());

  it("schedules a maintenance record", () => {
    const db = getSnapshot();
    const record = scheduleMaintenance(draft(db.vehicles[0].id), ACTOR);
    expect(record.status).toBe("scheduled");
    expect(getSnapshot().maintenanceRecords.some((m) => m.id === record.id)).toBe(true);
  });

  it("marks the vehicle 'maintenance' when a record moves to in-progress", () => {
    const db = getSnapshot();
    const vehicle = db.vehicles[0];
    const record = scheduleMaintenance(draft(vehicle.id), ACTOR);
    expect(setMaintenanceStatus(record.id, "in-progress", ACTOR).ok).toBe(true);
    expect(getSnapshot().vehicles.find((v) => v.id === vehicle.id)?.status).toBe("maintenance");
  });

  it("refuses to update a non-existent record", () => {
    expect(setMaintenanceStatus("no-such-record", "in-progress", ACTOR).ok).toBe(false);
  });
});

describe("completeMaintenance", () => {
  beforeEach(() => resetDemoData());

  it("completes a record and returns the vehicle to available when no other work order is open", () => {
    const db = getSnapshot();
    const vehicle = db.vehicles[0];
    const record = scheduleMaintenance(draft(vehicle.id), ACTOR);
    setMaintenanceStatus(record.id, "in-progress", ACTOR);

    const result = completeMaintenance(record.id, { cost: moneyFromMajor(3000, "INR"), labourCost: moneyFromMajor(800, "INR"), odometerKm: vehicle.odometerKm + 100 }, ACTOR);
    expect(result.ok).toBe(true);

    const after = getSnapshot();
    expect(after.maintenanceRecords.find((m) => m.id === record.id)?.status).toBe("completed");
    expect(after.vehicles.find((v) => v.id === vehicle.id)?.status).toBe("available");
    expect(after.vehicles.find((v) => v.id === vehicle.id)?.odometerKm).toBe(vehicle.odometerKm + 100);
  });

  it("keeps the vehicle in maintenance if another work order is still open", () => {
    const db = getSnapshot();
    const vehicle = db.vehicles[0];
    const first = scheduleMaintenance(draft(vehicle.id), ACTOR);
    const second = scheduleMaintenance(draft(vehicle.id), ACTOR);
    setMaintenanceStatus(first.id, "in-progress", ACTOR);
    setMaintenanceStatus(second.id, "in-progress", ACTOR);

    completeMaintenance(first.id, { cost: zeroMoney("INR"), labourCost: zeroMoney("INR") }, ACTOR);
    expect(getSnapshot().vehicles.find((v) => v.id === vehicle.id)?.status).toBe("maintenance");
  });

  it("refuses to complete a non-existent record", () => {
    expect(completeMaintenance("no-such-record", { cost: zeroMoney("INR"), labourCost: zeroMoney("INR") }, ACTOR).ok).toBe(false);
  });
});

describe("addMaintenancePart", () => {
  beforeEach(() => resetDemoData());

  it("adds a part to an existing maintenance record", () => {
    const db = getSnapshot();
    const record = scheduleMaintenance(draft(db.vehicles[0].id), ACTOR);
    const result = addMaintenancePart({ maintenanceId: record.id, name: "Brake pads", quantity: 2, cost: moneyFromMajor(1200, "INR") }, ACTOR);
    expect(result.ok).toBe(true);
    const after = getSnapshot().maintenanceRecords.find((m) => m.id === record.id);
    expect(after?.parts).toHaveLength(1);
    expect(after?.parts[0].name).toBe("Brake pads");
  });

  it("refuses to add a part to a non-existent maintenance record", () => {
    const result = addMaintenancePart({ maintenanceId: "no-such-record", name: "Test", quantity: 1, cost: zeroMoney("INR") }, ACTOR);
    expect(result.ok).toBe(false);
  });
});
