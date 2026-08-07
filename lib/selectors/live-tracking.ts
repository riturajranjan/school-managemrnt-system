import type { Db } from "@/lib/data/store";
import type { TransportTrip } from "@/lib/types/transport";
import { GPS_STALE_THRESHOLD_MINUTES, type GPSPosition } from "@/lib/types/gps";

/** A GPS ping older than the stale threshold (or timestamped in the future,
 * which indicates a clock/ingestion problem) is never presented as live —
 * every consumer must go through this, never compare timestamps inline. */
export function isGpsStale(recordedAt: string, now: Date = new Date()): boolean {
  const ageMs = now.getTime() - new Date(recordedAt).getTime();
  return ageMs > GPS_STALE_THRESHOLD_MINUTES * 60 * 1000 || ageMs < 0;
}

export function latestGpsPosition(db: Db, vehicleId: string): GPSPosition | undefined {
  const positions = db.gpsPositions.filter((p) => p.vehicleId === vehicleId);
  return positions.sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1))[0];
}

export type VehicleLiveState = "not-started" | "boarding" | "in-transit" | "at-stop" | "delayed" | "off-route" | "breakdown" | "emergency" | "completed" | "gps-offline" | "cancelled";

export const vehicleLiveStateLabels: Record<VehicleLiveState, string> = {
  "not-started": "Not started",
  boarding: "Boarding",
  "in-transit": "In transit",
  "at-stop": "At stop",
  delayed: "Delayed",
  "off-route": "Off route",
  breakdown: "Breakdown",
  emergency: "Emergency",
  completed: "Completed",
  "gps-offline": "GPS offline",
  cancelled: "Cancelled",
};

/** Derives the spec's 11-state vehicle vocabulary from the trip's own
 * status, its GPS freshness and any unresolved route deviation — a
 * presentation-layer computation, never a second stored status field that
 * could drift from the trip record it describes. */
export function computeVehicleLiveState(db: Db, trip: TransportTrip, now: Date = new Date()): VehicleLiveState {
  if (trip.status === "cancelled") return "cancelled";
  if (trip.status === "completed") return "completed";
  if (trip.status === "breakdown") return "breakdown";
  if (trip.status === "emergency") return "emergency";
  if (trip.status === "scheduled" || trip.status === "ready") return "not-started";

  const position = latestGpsPosition(db, trip.vehicleId);
  if (!position || isGpsStale(position.recordedAt, now)) return "gps-offline";

  const hasOpenDeviation = db.routeDeviations.some((d) => d.tripId === trip.id && !d.resolvedAt);
  if (hasOpenDeviation) return "off-route";
  if (trip.status === "delayed") return "delayed";
  if (trip.status === "boarding") return "boarding";

  const atStop = db.tripStops.some((s) => s.tripId === trip.id && s.status === "arrived");
  return atStop ? "at-stop" : "in-transit";
}

/** Maps a lat/long point to a 0-100 SVG viewport coordinate given a
 * bounding box — used by the lightweight route-corridor/live map, which is
 * a data-driven SVG visualization rather than a tile-based map (this demo
 * has no map-tile provider or API key configured). */
export function projectToViewport(latitude: number, longitude: number, bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number }, padding = 8): { x: number; y: number } {
  const latRange = bounds.maxLat - bounds.minLat || 1;
  const lngRange = bounds.maxLng - bounds.minLng || 1;
  const x = padding + ((longitude - bounds.minLng) / lngRange) * (100 - padding * 2);
  const y = padding + (1 - (latitude - bounds.minLat) / latRange) * (100 - padding * 2);
  return { x, y };
}

export function computeBounds(points: { latitude: number; longitude: number }[]): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  if (points.length === 0) return { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 };
  return {
    minLat: Math.min(...points.map((p) => p.latitude)),
    maxLat: Math.max(...points.map((p) => p.latitude)),
    minLng: Math.min(...points.map((p) => p.longitude)),
    maxLng: Math.max(...points.map((p) => p.longitude)),
  };
}
