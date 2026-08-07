import { getSnapshot, setState } from "@/lib/data/store";
import type { FuelRecord } from "@/lib/types/transport";
import { generateId } from "@/lib/utils";
import { logTransportAudit } from "./transport-audit-service";

type Actor = { name: string; role: string };
type Result = { ok: true; record: FuelRecord } | { ok: false; error: string };

export type FuelDraft = Omit<FuelRecord, "id">;

export function logFuelEntry(draft: FuelDraft, actor: Actor): Result {
  const db = getSnapshot();
  const vehicle = db.vehicles.find((v) => v.id === draft.vehicleId);
  if (!vehicle) return { ok: false, error: "Vehicle not found." };
  if (draft.quantityLitres <= 0) return { ok: false, error: "Quantity must be greater than zero." };
  if (draft.odometerKm < vehicle.odometerKm) return { ok: false, error: "Odometer reading cannot be behind the vehicle's last recorded reading." };

  const record: FuelRecord = { ...draft, id: generateId("fuel") };
  const now = new Date().toISOString();

  setState((current) => ({
    ...current,
    fuelRecords: [...current.fuelRecords, record],
    vehicles: current.vehicles.map((v) => (v.id === draft.vehicleId ? { ...v, odometerKm: record.odometerKm, updatedAt: now } : v)),
  }));

  logTransportAudit({ subjectId: draft.vehicleId, action: "fuel-entry-added", actorName: actor.name, actorRole: actor.role, summary: `${record.quantityLitres}L ${record.fuelType} logged for ${vehicle.registrationNumber} at ${record.odometerKm} km.` });
  return { ok: true, record };
}
