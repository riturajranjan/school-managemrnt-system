import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { createRoute, setRouteStatus, addStopToRoute } from "./route-service";
import { createTripForRoute, markTripStopStatus, setTripStatus } from "./trip-service";

const ACTOR = { name: "Dispatcher", role: "Dispatcher" };

describe("createTripForRoute", () => {
  beforeEach(() => resetDemoData());

  it("creates a scheduled trip with stop timeline and student roster seeded from the route", () => {
    const db = getSnapshot();
    const route = db.transportRoutes.find((r) => r.status === "active" && r.assignedVehicleId && r.primaryDriverId)!;
    const result = createTripForRoute(route.id, "2026-09-01", ACTOR);
    expect(result.ok).toBe(true);
    if (!result.ok || !result.trip) return;
    expect(result.trip.status).toBe("scheduled");

    const after = getSnapshot();
    const stops = after.tripStops.filter((s) => s.tripId === result.trip!.id);
    const routeStopCount = after.routeStops.filter((rs) => rs.routeId === route.id).length;
    expect(stops.length).toBe(routeStopCount);

    const students = after.tripStudents.filter((s) => s.tripId === result.trip!.id);
    const assignedCount = after.studentTransportAssignments.filter((a) => a.routeId === route.id && a.status === "active").length;
    expect(students.length).toBe(assignedCount);
  });

  it("refuses to create a duplicate trip for the same route and date", () => {
    const db = getSnapshot();
    const route = db.transportRoutes.find((r) => r.status === "active" && r.assignedVehicleId && r.primaryDriverId)!;
    createTripForRoute(route.id, "2026-09-01", ACTOR);
    const second = createTripForRoute(route.id, "2026-09-01", ACTOR);
    expect(second.ok).toBe(false);
  });

  it("refuses a trip for a route with no assigned vehicle or driver", () => {
    const db = getSnapshot();
    const created = createRoute({ name: "Crewless Route", branch: "main", shift: "morning", direction: "both", type: "morning-pickup", startPoint: "Test", endPoint: "Novyra Public School", distanceKm: 5, estimatedDurationMinutes: 15, vehicleType: "van", maxCapacity: 10, effectiveFrom: "2026-04-01", status: "draft" }, ACTOR);
    if (!created.ok || !created.route) return;
    addStopToRoute(created.route.id, { stopId: db.transportStops[0].id, sequence: 1, waitingMinutes: 3 }, ACTOR);
    setRouteStatus(created.route.id, "active", ACTOR);
    const result = createTripForRoute(created.route.id, "2026-09-01", ACTOR);
    expect(result.ok).toBe(false);
  });
});

describe("setTripStatus", () => {
  beforeEach(() => resetDemoData());

  it("stamps actualStart the first time a trip is moved into an active state", () => {
    const db = getSnapshot();
    const route = db.transportRoutes.find((r) => r.status === "active" && r.assignedVehicleId && r.primaryDriverId)!;
    const created = createTripForRoute(route.id, "2026-09-01", ACTOR);
    if (!created.ok || !created.trip) return;
    expect(setTripStatus(created.trip.id, "boarding", ACTOR).ok).toBe(true);
    const after = getSnapshot().transportTrips.find((t) => t.id === created.trip!.id)!;
    expect(after.actualStart).toBeTruthy();
  });

  it("stamps actualEnd when a trip completes", () => {
    const db = getSnapshot();
    const route = db.transportRoutes.find((r) => r.status === "active" && r.assignedVehicleId && r.primaryDriverId)!;
    const created = createTripForRoute(route.id, "2026-09-01", ACTOR);
    if (!created.ok || !created.trip) return;
    setTripStatus(created.trip.id, "in-progress", ACTOR);
    setTripStatus(created.trip.id, "completed", ACTOR);
    const after = getSnapshot().transportTrips.find((t) => t.id === created.trip!.id)!;
    expect(after.actualEnd).toBeTruthy();
  });

  it("refuses to update a non-existent trip", () => {
    expect(setTripStatus("no-such-trip", "completed", ACTOR).ok).toBe(false);
  });
});

describe("markTripStopStatus", () => {
  beforeEach(() => resetDemoData());

  it("marks a stop arrived and stamps actualArrival", () => {
    const db = getSnapshot();
    const route = db.transportRoutes.find((r) => r.status === "active" && r.assignedVehicleId && r.primaryDriverId)!;
    const created = createTripForRoute(route.id, "2026-09-01", ACTOR);
    if (!created.ok || !created.trip) return;
    const firstStop = getSnapshot().tripStops.find((s) => s.tripId === created.trip!.id && s.sequence === 1)!;
    const result = markTripStopStatus(firstStop.id, "arrived", ACTOR);
    expect(result.ok).toBe(true);
    const after = getSnapshot().tripStops.find((s) => s.id === firstStop.id)!;
    expect(after.status).toBe("arrived");
    expect(after.actualArrival).toBeTruthy();
  });
});
