import { describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { computeBounds, computeVehicleLiveState, isGpsStale, projectToViewport } from "./live-tracking";

describe("isGpsStale", () => {
  it("treats a recent ping as live", () => {
    const now = new Date("2026-08-06T10:00:00.000Z");
    expect(isGpsStale(new Date(now.getTime() - 60000).toISOString(), now)).toBe(false);
  });

  it("treats a ping older than the stale threshold as stale", () => {
    const now = new Date("2026-08-06T10:00:00.000Z");
    expect(isGpsStale(new Date(now.getTime() - 10 * 60000).toISOString(), now)).toBe(true);
  });

  it("treats a future-timestamped ping as stale (clock/ingestion problem)", () => {
    const now = new Date("2026-08-06T10:00:00.000Z");
    expect(isGpsStale(new Date(now.getTime() + 60000).toISOString(), now)).toBe(true);
  });
});

describe("computeVehicleLiveState", () => {
  it("maps a scheduled trip to not-started", () => {
    resetDemoData();
    const db = getSnapshot();
    const trip = db.transportTrips.find((t) => t.status === "scheduled");
    if (!trip) return;
    expect(computeVehicleLiveState(db, trip)).toBe("not-started");
  });

  it("maps a completed trip to completed regardless of GPS state", () => {
    resetDemoData();
    const db = getSnapshot();
    const trip = db.transportTrips.find((t) => t.status === "completed");
    if (!trip) return;
    expect(computeVehicleLiveState(db, trip)).toBe("completed");
  });

  it("reports gps-offline for an in-progress trip with no recent GPS position", () => {
    resetDemoData();
    const db = getSnapshot();
    const trip = db.transportTrips.find((t) => t.status === "in-progress" || t.status === "boarding" || t.status === "delayed");
    if (!trip) return;
    const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    expect(computeVehicleLiveState(db, trip, farFuture)).toBe("gps-offline");
  });
});

describe("projectToViewport / computeBounds", () => {
  it("projects a point within bounds into the padded 0-100 viewport range", () => {
    const bounds = { minLat: 12.9, maxLat: 13.0, minLng: 77.5, maxLng: 77.7 };
    const { x, y } = projectToViewport(12.95, 77.6, bounds);
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThanOrEqual(100);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(100);
  });

  it("computes bounds spanning every given point", () => {
    const points = [
      { latitude: 12.9, longitude: 77.5 },
      { latitude: 13.0, longitude: 77.7 },
    ];
    const bounds = computeBounds(points);
    expect(bounds.minLat).toBe(12.9);
    expect(bounds.maxLat).toBe(13.0);
    expect(bounds.minLng).toBe(77.5);
    expect(bounds.maxLng).toBe(77.7);
  });

  it("returns a safe default bounds for an empty point list", () => {
    expect(computeBounds([])).toEqual({ minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 });
  });
});
