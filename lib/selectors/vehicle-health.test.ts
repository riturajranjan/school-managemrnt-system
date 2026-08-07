import { describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { computeVehicleHealth } from "./vehicle-health";

describe("computeVehicleHealth", () => {
  it("produces a score within [0, 100] from four weighted, real components", () => {
    resetDemoData();
    const db = getSnapshot();
    for (const vehicle of db.vehicles) {
      const health = computeVehicleHealth(db, vehicle);
      expect(health.score).toBeGreaterThanOrEqual(0);
      expect(health.score).toBeLessThanOrEqual(100);
      expect(health.components).toHaveLength(4);
      const totalWeight = health.components.reduce((sum, c) => sum + c.weight, 0);
      expect(totalWeight).toBeCloseTo(1, 5);
    }
  });

  it("flags a main risk when the vehicle has an overdue maintenance record", () => {
    resetDemoData();
    const db = getSnapshot();
    const overdueRecord = db.maintenanceRecords.find((m) => m.status === "overdue");
    if (!overdueRecord) return;
    const vehicle = db.vehicles.find((v) => v.id === overdueRecord.vehicleId)!;
    const health = computeVehicleHealth(db, vehicle);
    expect(health.mainRisk).toBeTruthy();
  });

  it("scores a vehicle with no documents or maintenance history as fully healthy on those components", () => {
    resetDemoData();
    const db = getSnapshot();
    const cleanVehicle = { ...db.vehicles[0], id: "vehicle-clean-test" };
    const cleanDb = { ...db, vehicleDocuments: db.vehicleDocuments.filter((d) => d.vehicleId !== cleanVehicle.id), maintenanceRecords: db.maintenanceRecords.filter((m) => m.vehicleId !== cleanVehicle.id), transportIncidents: db.transportIncidents.filter((i) => i.vehicleId !== cleanVehicle.id) };
    const health = computeVehicleHealth(cleanDb, cleanVehicle);
    const documents = health.components.find((c) => c.key === "documents")!;
    const maintenance = health.components.find((c) => c.key === "maintenance")!;
    expect(documents.value).toBe(100);
    expect(maintenance.value).toBe(100);
  });
});
