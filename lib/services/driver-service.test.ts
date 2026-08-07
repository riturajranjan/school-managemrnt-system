import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { addDriverDocument, addDriverTraining, createDriver, setDriverAvailability, setDriverStatus, updateDriver, updateDriverDocument } from "./driver-service";

const ACTOR = { name: "Transport Administrator", role: "Transport Administrator" };

function draft(overrides: Partial<Parameters<typeof createDriver>[0]> = {}) {
  return {
    name: "Test Driver",
    employeeCode: "DRV-TEST-01",
    phone: "9800000000",
    joiningDate: "2024-01-01",
    licenseNumber: "KATESTLIC001",
    licenseClass: "Heavy Motor Vehicle",
    licenseExpiry: "2028-01-01",
    backgroundVerified: true,
    medicalFitnessValid: true,
    branch: "main",
    ...overrides,
  };
}

describe("createDriver / updateDriver / setDriverStatus", () => {
  beforeEach(() => resetDemoData());

  it("creates a driver in available status", () => {
    const result = createDriver(draft(), ACTOR);
    expect(result.ok).toBe(true);
    if (!result.ok || !result.driver) return;
    expect(result.driver.status).toBe("available");
    expect(getSnapshot().drivers.some((d) => d.id === result.driver!.id)).toBe(true);
  });

  it("refuses a duplicate license number", () => {
    const db = getSnapshot();
    const existing = db.drivers[0];
    const result = createDriver(draft({ licenseNumber: existing.licenseNumber }), ACTOR);
    expect(result.ok).toBe(false);
  });

  it("updates a driver's fields", () => {
    const created = createDriver(draft(), ACTOR);
    if (!created.ok || !created.driver) return;
    const result = updateDriver(created.driver.id, { phone: "9811111111" }, ACTOR);
    expect(result.ok).toBe(true);
    expect(getSnapshot().drivers.find((d) => d.id === created.driver!.id)?.phone).toBe("9811111111");
  });

  it("changes a driver's status with a reason", () => {
    const created = createDriver(draft(), ACTOR);
    if (!created.ok || !created.driver) return;
    const result = setDriverStatus(created.driver.id, "suspended", ACTOR, "Pending investigation");
    expect(result.ok).toBe(true);
    expect(getSnapshot().drivers.find((d) => d.id === created.driver!.id)?.status).toBe("suspended");
  });
});

describe("addDriverDocument / updateDriverDocument / addDriverTraining / setDriverAvailability", () => {
  beforeEach(() => resetDemoData());

  it("adds and updates a driver document", () => {
    const db = getSnapshot();
    const driver = db.drivers[0];
    const document = addDriverDocument({ driverId: driver.id, type: "license", expiryDate: "2028-01-01", status: "valid" }, ACTOR);
    expect(getSnapshot().driverDocuments.some((d) => d.id === document.id)).toBe(true);
    expect(updateDriverDocument(document.id, { status: "expired" }, ACTOR).ok).toBe(true);
  });

  it("records a training entry", () => {
    const db = getSnapshot();
    const driver = db.drivers[0];
    const training = addDriverTraining({ driverId: driver.id, title: "Road safety refresher", completedAt: new Date().toISOString() }, ACTOR);
    expect(getSnapshot().driverTraining.some((t) => t.id === training.id)).toBe(true);
  });

  it("sets availability, replacing any existing entry for the same date", () => {
    const db = getSnapshot();
    const driver = db.drivers[0];
    setDriverAvailability(driver.id, "2026-09-01", "on-leave", ACTOR, "Family emergency");
    setDriverAvailability(driver.id, "2026-09-01", "available", ACTOR);
    const entries = getSnapshot().driverAvailability.filter((a) => a.driverId === driver.id && a.date === "2026-09-01");
    expect(entries).toHaveLength(1);
    expect(entries[0].status).toBe("available");
  });
});
