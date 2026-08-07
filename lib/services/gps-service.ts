import { getSnapshot, setState } from "@/lib/data/store";
import type { GPSPosition } from "@/lib/types/gps";
import { generateId } from "@/lib/utils";
import { logTransportAudit } from "./transport-audit-service";

type Actor = { name: string; role: string };
type Result = { ok: true } | { ok: false; error: string };

export type GpsIngestInput = { deviceId: string; vehicleId: string; tripId?: string; latitude: number; longitude: number; speedKmh: number; headingDegrees: number; accuracyMeters: number; ignitionOn?: boolean; recordedAt: string };

const VALID_LAT = (lat: number) => lat >= -90 && lat <= 90;
const VALID_LNG = (lng: number) => lng >= -180 && lng <= 180;

/** The single ingestion entrypoint every GPS provider (hardware tracker,
 * mobile device, external vendor) would call in production. Rejects
 * invalid coordinates and out-of-order pings against the vehicle's own
 * last-known position rather than trusting the source blindly. */
export function recordGpsPosition(input: GpsIngestInput): Result & { position?: GPSPosition } {
  const db = getSnapshot();
  if (!VALID_LAT(input.latitude) || !VALID_LNG(input.longitude)) return { ok: false, error: "Invalid coordinates." };

  const lastForVehicle = [...db.gpsPositions].filter((p) => p.vehicleId === input.vehicleId).sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1))[0];
  if (lastForVehicle && input.recordedAt < lastForVehicle.recordedAt) {
    return { ok: false, error: "Out-of-order ping — older than the last known position for this vehicle." };
  }
  const isDuplicate = lastForVehicle && lastForVehicle.recordedAt === input.recordedAt && lastForVehicle.latitude === input.latitude && lastForVehicle.longitude === input.longitude;
  if (isDuplicate) return { ok: true, position: lastForVehicle };

  const position: GPSPosition = { ...input, id: generateId("gpsp"), receivedAt: new Date().toISOString() };
  setState((current) => ({ ...current, gpsPositions: [...current.gpsPositions, position] }));
  return { ok: true, position };
}

/** Demo-only: this app has no real hardware tracker or mobile-device feed,
 * so live tracking is demonstrated by nudging each in-progress trip's
 * vehicle a small step further along its route each time this is invoked —
 * standing in for a provider's periodic ping the same way Phase 5's
 * simulateGatewayCallback stood in for a payment webhook. */
export function simulateNextGpsTick(actor: Actor): { updated: number } {
  const db = getSnapshot();
  let updated = 0;
  const now = new Date().toISOString();

  for (const trip of db.transportTrips) {
    if (trip.status !== "in-progress" && trip.status !== "boarding" && trip.status !== "delayed") continue;
    const device = db.gpsDevices.find((g) => g.vehicleId === trip.vehicleId);
    if (!device || device.status === "offline") continue;

    const last = [...db.gpsPositions].filter((p) => p.vehicleId === trip.vehicleId).sort((a, b) => (a.recordedAt < b.recordedAt ? 1 : -1))[0];
    const baseLat = last?.latitude ?? 12.97;
    const baseLng = last?.longitude ?? 77.6;
    const jitter = () => (Math.random() - 0.5) * 0.004;

    const result = recordGpsPosition({ deviceId: device.id, vehicleId: trip.vehicleId, tripId: trip.id, latitude: baseLat + jitter(), longitude: baseLng + jitter(), speedKmh: trip.status === "delayed" ? 6 : 24 + Math.round(Math.random() * 18), headingDegrees: Math.round(Math.random() * 359), accuracyMeters: 10, ignitionOn: true, recordedAt: now });
    if (result.ok) updated += 1;
  }

  if (updated > 0) logTransportAudit({ action: "manual-override-used", actorName: actor.name, actorRole: actor.role, summary: `Simulated GPS tick updated ${updated} vehicle(s).` });
  return { updated };
}
