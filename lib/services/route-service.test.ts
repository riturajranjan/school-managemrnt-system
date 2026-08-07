import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { addStopToRoute, createRoute, removeStopFromRoute, reorderRouteStops, setRouteStatus, updateRoute, validateRoute, validateRouteStops, type RouteDraft } from "./route-service";

const ACTOR = { name: "Transport Administrator", role: "Transport Administrator" };

function draft(overrides: Partial<RouteDraft> = {}): Omit<RouteDraft, "code"> & { code?: string } {
  return {
    name: "Test Route",
    branch: "main",
    shift: "morning",
    direction: "both",
    type: "morning-pickup",
    startPoint: "Test Locality",
    endPoint: "Novyra Public School",
    distanceKm: 10,
    estimatedDurationMinutes: 30,
    vehicleType: "bus",
    maxCapacity: 40,
    effectiveFrom: "2026-04-01",
    status: "draft",
    ...overrides,
  };
}

describe("createRoute / updateRoute / setRouteStatus", () => {
  beforeEach(() => resetDemoData());

  it("creates a draft route with an auto-generated sequential code", () => {
    const result = createRoute(draft(), ACTOR);
    expect(result.ok).toBe(true);
    if (!result.ok || !result.route) return;
    expect(result.route.status).toBe("draft");
    expect(result.route.code).toMatch(/^RT-\d{2}$/);
  });

  it("refuses to create an active route with a duplicate code against another active route", () => {
    const db = getSnapshot();
    const existingActive = db.transportRoutes.find((r) => r.status === "active")!;
    const result = createRoute(draft({ code: existingActive.code, status: "active", endPoint: "Novyra Public School" }), ACTOR);
    expect(result.ok).toBe(false);
  });

  it("refuses a route with no school endpoint", () => {
    const result = createRoute(draft({ endPoint: "" }), ACTOR);
    expect(result.ok).toBe(false);
  });

  it("refuses a route whose capacity exceeds its assigned vehicle's capacity", () => {
    const db = getSnapshot();
    const vehicle = db.vehicles[0];
    const result = createRoute(draft({ assignedVehicleId: vehicle.id, vehicleType: vehicle.type, maxCapacity: vehicle.capacity + 100 }), ACTOR);
    expect(result.ok).toBe(false);
  });

  it("refuses a route whose vehicle type doesn't match the assigned vehicle", () => {
    const db = getSnapshot();
    const busVehicle = db.vehicles.find((v) => v.type === "bus")!;
    const result = createRoute(draft({ assignedVehicleId: busVehicle.id, vehicleType: "van", maxCapacity: 10 }), ACTOR);
    expect(result.ok).toBe(false);
  });

  it("refuses a route whose primary driver is already primary on another active route in the same shift", () => {
    const db = getSnapshot();
    const activeRoute = db.transportRoutes.find((r) => r.status === "active" && r.primaryDriverId)!;
    const result = createRoute(draft({ primaryDriverId: activeRoute.primaryDriverId, shift: activeRoute.shift }), ACTOR);
    expect(result.ok).toBe(false);
  });

  it("refuses invalid effective dates (effectiveTo before effectiveFrom)", () => {
    const result = createRoute(draft({ effectiveFrom: "2026-06-01", effectiveTo: "2026-01-01" }), ACTOR);
    expect(result.ok).toBe(false);
  });

  it("updates a route and refuses an update that would break validation", () => {
    const created = createRoute(draft(), ACTOR);
    if (!created.ok || !created.route) return;
    expect(updateRoute(created.route.id, { name: "Renamed Route" }, ACTOR).ok).toBe(true);
    expect(getSnapshot().transportRoutes.find((r) => r.id === created.route!.id)?.name).toBe("Renamed Route");
    expect(updateRoute(created.route.id, { endPoint: "" }, ACTOR).ok).toBe(false);
  });

  it("refuses to activate a route with no stops or an invalid stop sequence", () => {
    const created = createRoute(draft(), ACTOR);
    if (!created.ok || !created.route) return;
    const db = getSnapshot();
    const stop = db.transportStops[0];
    addStopToRoute(created.route.id, { stopId: stop.id, sequence: 5, waitingMinutes: 3 }, ACTOR);
    const result = setRouteStatus(created.route.id, "active", ACTOR);
    expect(result.ok).toBe(false);
  });

  it("activates a route once it has a clean, sequential stop list", () => {
    const created = createRoute(draft({ code: "RT-UNIQUE-TEST" }), ACTOR);
    if (!created.ok || !created.route) return;
    const db = getSnapshot();
    addStopToRoute(created.route.id, { stopId: db.transportStops[0].id, sequence: 1, pickupTime: "07:00", waitingMinutes: 3 }, ACTOR);
    addStopToRoute(created.route.id, { stopId: db.transportStops[1].id, sequence: 2, pickupTime: "07:15", waitingMinutes: 3 }, ACTOR);
    const result = setRouteStatus(created.route.id, "active", ACTOR);
    expect(result.ok).toBe(true);
    expect(getSnapshot().transportRoutes.find((r) => r.id === created.route!.id)?.status).toBe("active");
  });
});

describe("addStopToRoute / removeStopFromRoute / reorderRouteStops", () => {
  beforeEach(() => resetDemoData());

  it("refuses to add the same stop to a route twice", () => {
    const created = createRoute(draft(), ACTOR);
    if (!created.ok || !created.route) return;
    const db = getSnapshot();
    const stop = db.transportStops[0];
    expect(addStopToRoute(created.route.id, { stopId: stop.id, sequence: 1, waitingMinutes: 3 }, ACTOR).ok).toBe(true);
    expect(addStopToRoute(created.route.id, { stopId: stop.id, sequence: 2, waitingMinutes: 3 }, ACTOR).ok).toBe(false);
  });

  it("removes a stop from a route", () => {
    const created = createRoute(draft(), ACTOR);
    if (!created.ok || !created.route) return;
    const db = getSnapshot();
    const added = addStopToRoute(created.route.id, { stopId: db.transportStops[0].id, sequence: 1, waitingMinutes: 3 }, ACTOR);
    if (!added.ok || !added.routeStop) return;
    expect(removeStopFromRoute(added.routeStop.id, ACTOR).ok).toBe(true);
    expect(getSnapshot().routeStops.some((rs) => rs.id === added.routeStop!.id)).toBe(false);
  });

  it("reorders route stops to match the given stop-id order", () => {
    const created = createRoute(draft(), ACTOR);
    if (!created.ok || !created.route) return;
    const db = getSnapshot();
    const [stopA, stopB] = db.transportStops;
    addStopToRoute(created.route.id, { stopId: stopA.id, sequence: 1, waitingMinutes: 3 }, ACTOR);
    addStopToRoute(created.route.id, { stopId: stopB.id, sequence: 2, waitingMinutes: 3 }, ACTOR);
    reorderRouteStops(created.route.id, [stopB.id, stopA.id], ACTOR);
    const stops = getSnapshot()
      .routeStops.filter((rs) => rs.routeId === created.route!.id)
      .sort((a, b) => a.sequence - b.sequence);
    expect(stops[0].stopId).toBe(stopB.id);
    expect(stops[1].stopId).toBe(stopA.id);
  });
});

describe("validateRoute / validateRouteStops (direct unit checks)", () => {
  it("flags a route with zero max capacity", () => {
    resetDemoData();
    const db = getSnapshot();
    const errors = validateRoute(db, draft({ maxCapacity: 0 }) as RouteDraft);
    expect(errors.some((e) => e.includes("capacity"))).toBe(true);
  });

  it("flags impossible time sequence directly via validateRouteStops", () => {
    resetDemoData();
    const created = createRoute(draft(), ACTOR);
    if (!created.ok || !created.route) return;
    const db = getSnapshot();
    addStopToRoute(created.route.id, { stopId: db.transportStops[0].id, sequence: 1, pickupTime: "08:00", waitingMinutes: 3 }, ACTOR);
    addStopToRoute(created.route.id, { stopId: db.transportStops[1].id, sequence: 2, pickupTime: "07:00", waitingMinutes: 3 }, ACTOR);
    const errors = validateRouteStops(getSnapshot(), created.route.id);
    expect(errors.some((e) => e.includes("impossible time sequence"))).toBe(true);
  });
});
