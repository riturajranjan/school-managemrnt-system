import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { recordGpsPosition, simulateNextGpsTick } from "./gps-service";

const ACTOR = { name: "Dispatcher", role: "Dispatcher" };

describe("recordGpsPosition", () => {
  beforeEach(() => resetDemoData());

  it("records a valid position", () => {
    const db = getSnapshot();
    const device = db.gpsDevices[0];
    const before = db.gpsPositions.length;
    const result = recordGpsPosition({ deviceId: device.id, vehicleId: device.vehicleId, latitude: 12.9, longitude: 77.6, speedKmh: 20, headingDegrees: 90, accuracyMeters: 10, recordedAt: new Date().toISOString() });
    expect(result.ok).toBe(true);
    expect(getSnapshot().gpsPositions.length).toBe(before + 1);
  });

  it("refuses invalid coordinates", () => {
    const db = getSnapshot();
    const device = db.gpsDevices[0];
    const result = recordGpsPosition({ deviceId: device.id, vehicleId: device.vehicleId, latitude: 200, longitude: 77.6, speedKmh: 20, headingDegrees: 90, accuracyMeters: 10, recordedAt: new Date().toISOString() });
    expect(result.ok).toBe(false);
  });

  it("refuses an out-of-order ping older than the vehicle's last known position", () => {
    const db = getSnapshot();
    const device = db.gpsDevices[0];
    const now = new Date();
    recordGpsPosition({ deviceId: device.id, vehicleId: device.vehicleId, latitude: 12.9, longitude: 77.6, speedKmh: 20, headingDegrees: 90, accuracyMeters: 10, recordedAt: now.toISOString() });
    const earlier = new Date(now.getTime() - 60000).toISOString();
    const result = recordGpsPosition({ deviceId: device.id, vehicleId: device.vehicleId, latitude: 12.91, longitude: 77.61, speedKmh: 20, headingDegrees: 90, accuracyMeters: 10, recordedAt: earlier });
    expect(result.ok).toBe(false);
  });

  it("treats an identical duplicate ping as a no-op success rather than a new record", () => {
    const db = getSnapshot();
    const device = db.gpsDevices[0];
    const recordedAt = new Date().toISOString();
    recordGpsPosition({ deviceId: device.id, vehicleId: device.vehicleId, latitude: 12.9, longitude: 77.6, speedKmh: 20, headingDegrees: 90, accuracyMeters: 10, recordedAt });
    const before = getSnapshot().gpsPositions.length;
    const result = recordGpsPosition({ deviceId: device.id, vehicleId: device.vehicleId, latitude: 12.9, longitude: 77.6, speedKmh: 20, headingDegrees: 90, accuracyMeters: 10, recordedAt });
    expect(result.ok).toBe(true);
    expect(getSnapshot().gpsPositions.length).toBe(before);
  });
});

describe("simulateNextGpsTick", () => {
  beforeEach(() => resetDemoData());

  it("updates positions only for trips that are actively running", () => {
    const before = getSnapshot().gpsPositions.length;
    const result = simulateNextGpsTick(ACTOR);
    const runningTrips = getSnapshot().transportTrips.filter((t) => t.status === "in-progress" || t.status === "boarding" || t.status === "delayed");
    expect(result.updated).toBeLessThanOrEqual(runningTrips.length);
    if (runningTrips.length > 0) {
      expect(getSnapshot().gpsPositions.length).toBeGreaterThanOrEqual(before);
    }
  });
});
