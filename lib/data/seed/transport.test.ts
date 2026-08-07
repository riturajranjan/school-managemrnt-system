import { describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";

describe("transport seed data", () => {
  it("gives every route a valid assigned vehicle, primary driver and stops", () => {
    resetDemoData();
    const db = getSnapshot();
    expect(db.transportRoutes.length).toBeGreaterThan(0);
    for (const route of db.transportRoutes) {
      if (route.assignedVehicleId) expect(db.vehicles.some((v) => v.id === route.assignedVehicleId)).toBe(true);
      if (route.primaryDriverId) expect(db.drivers.some((d) => d.id === route.primaryDriverId)).toBe(true);
      const stops = db.routeStops.filter((rs) => rs.routeId === route.id);
      expect(stops.length).toBeGreaterThan(0);
    }
  });

  it("assigns route-stop sequences starting at 1 with no gaps or duplicates", () => {
    resetDemoData();
    const db = getSnapshot();
    for (const route of db.transportRoutes) {
      const sequences = db.routeStops
        .filter((rs) => rs.routeId === route.id)
        .map((rs) => rs.sequence)
        .sort((a, b) => a - b);
      expect(sequences).toEqual(sequences.map((_, i) => i + 1));
    }
  });

  it("never assigns more students to a route than its vehicle's capacity", () => {
    resetDemoData();
    const db = getSnapshot();
    for (const route of db.transportRoutes) {
      const vehicle = db.vehicles.find((v) => v.id === route.assignedVehicleId);
      if (!vehicle) continue;
      const assignedCount = db.studentTransportAssignments.filter((a) => a.routeId === route.id && a.status === "active").length;
      expect(assignedCount).toBeLessThanOrEqual(vehicle.capacity);
    }
  });

  it("keeps every occupied seat pointing at a real student and vehicle", () => {
    resetDemoData();
    const db = getSnapshot();
    const studentIds = new Set(db.students.map((s) => s.id));
    for (const seat of db.vehicleSeats) {
      if (!seat.studentId) continue;
      expect(studentIds.has(seat.studentId)).toBe(true);
      expect(db.vehicles.some((v) => v.id === seat.vehicleId)).toBe(true);
    }
  });

  it("mirrors an assigned student's route onto their denormalized transport summary", () => {
    resetDemoData();
    const db = getSnapshot();
    for (const assignment of db.studentTransportAssignments) {
      const student = db.students.find((s) => s.id === assignment.studentId);
      if (!student?.transport) continue;
      expect(student.transport.routeId).toBe(assignment.routeId);
    }
  });

  it("generates today's trips only for routes that exist", () => {
    resetDemoData();
    const db = getSnapshot();
    const routeIds = new Set(db.transportRoutes.map((r) => r.id));
    for (const trip of db.transportTrips) {
      expect(routeIds.has(trip.routeId)).toBe(true);
      expect(trip.studentsBoarded).toBeLessThanOrEqual(trip.studentsExpected);
      expect(trip.studentsDropped).toBeLessThanOrEqual(trip.studentsBoarded);
    }
  });

  it("every trip stop belongs to a real trip and a real stop on that trip's route", () => {
    resetDemoData();
    const db = getSnapshot();
    for (const tripStop of db.tripStops) {
      const trip = db.transportTrips.find((t) => t.id === tripStop.tripId);
      expect(trip).toBeTruthy();
      if (!trip) continue;
      const routeStopIds = new Set(db.routeStops.filter((rs) => rs.routeId === trip.routeId).map((rs) => rs.stopId));
      expect(routeStopIds.has(tripStop.stopId)).toBe(true);
    }
  });

  it("flags at least one vehicle document as expired or expiring soon, and one driver license issue, for the exception feed to have real data", () => {
    resetDemoData();
    const db = getSnapshot();
    expect(db.vehicleDocuments.some((d) => d.status === "expired" || d.status === "expiring-soon")).toBe(true);
    expect(db.drivers.some((d) => d.status === "license-expired" || d.status === "medical-review")).toBe(true);
  });

  it("gives every maintenance and fuel record a real vehicle reference", () => {
    resetDemoData();
    const db = getSnapshot();
    const vehicleIds = new Set(db.vehicles.map((v) => v.id));
    for (const record of db.maintenanceRecords) expect(vehicleIds.has(record.vehicleId)).toBe(true);
    for (const record of db.fuelRecords) expect(vehicleIds.has(record.vehicleId)).toBe(true);
  });

  it("produces GPS positions only for vehicles that actually have a device", () => {
    resetDemoData();
    const db = getSnapshot();
    const deviceVehicleIds = new Set(db.gpsDevices.map((g) => g.vehicleId));
    for (const position of db.gpsPositions) {
      expect(deviceVehicleIds.has(position.vehicleId)).toBe(true);
    }
  });

  it("regenerates identically across repeated resets (deterministic seed)", () => {
    resetDemoData();
    const first = getSnapshot().transportRoutes.map((r) => r.id);
    resetDemoData();
    const second = getSnapshot().transportRoutes.map((r) => r.id);
    expect(second).toEqual(first);
  });
});
