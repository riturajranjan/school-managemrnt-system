import { getSnapshot, setState } from "@/lib/data/store";
import type { MaintenancePart, MaintenanceRecord, MaintenanceStatus } from "@/lib/types/transport";
import { generateId } from "@/lib/utils";
import { logTransportAudit } from "./transport-audit-service";

type Actor = { name: string; role: string };
type Result = { ok: true } | { ok: false; error: string };

export type MaintenanceDraft = Omit<MaintenanceRecord, "id" | "createdAt" | "status" | "completedDate">;

export function scheduleMaintenance(draft: MaintenanceDraft, actor: Actor): MaintenanceRecord {
  const db = getSnapshot();
  const vehicle = db.vehicles.find((v) => v.id === draft.vehicleId);
  const record: MaintenanceRecord = { ...draft, id: generateId("maint"), status: "scheduled", createdAt: new Date().toISOString() };

  setState((current) => ({ ...current, maintenanceRecords: [...current.maintenanceRecords, record] }));
  logTransportAudit({ subjectId: draft.vehicleId, action: "maintenance-created", actorName: actor.name, actorRole: actor.role, summary: `${record.type.replace(/-/g, " ")} scheduled for ${vehicle?.registrationNumber ?? draft.vehicleId} on ${record.scheduledDate}.` });
  return record;
}

export function setMaintenanceStatus(maintenanceId: string, status: MaintenanceStatus, actor: Actor): Result {
  const db = getSnapshot();
  const record = db.maintenanceRecords.find((m) => m.id === maintenanceId);
  if (!record) return { ok: false, error: "Maintenance record not found." };

  setState((current) => ({
    ...current,
    maintenanceRecords: current.maintenanceRecords.map((m) => (m.id === maintenanceId ? { ...m, status } : m)),
    vehicles: status === "in-progress" ? current.vehicles.map((v) => (v.id === record.vehicleId ? { ...v, status: "maintenance", updatedAt: new Date().toISOString() } : v)) : current.vehicles,
  }));

  const vehicle = db.vehicles.find((v) => v.id === record.vehicleId);
  logTransportAudit({ subjectId: record.vehicleId, action: "maintenance-created", actorName: actor.name, actorRole: actor.role, summary: `Maintenance for ${vehicle?.registrationNumber ?? record.vehicleId} marked ${status}.` });
  return { ok: true };
}

/** Completing a maintenance record also returns the vehicle to service —
 * a vehicle can't silently stay in "maintenance" status after its only
 * open work order closes. */
export function completeMaintenance(maintenanceId: string, completion: { cost: MaintenanceRecord["cost"]; labourCost: MaintenanceRecord["labourCost"]; odometerKm?: number; nextDueDate?: string; nextDueOdometerKm?: number; notes?: string }, actor: Actor): Result {
  const db = getSnapshot();
  const record = db.maintenanceRecords.find((m) => m.id === maintenanceId);
  if (!record) return { ok: false, error: "Maintenance record not found." };

  const now = new Date().toISOString();
  const stillInMaintenance = db.maintenanceRecords.some((m) => m.id !== maintenanceId && m.vehicleId === record.vehicleId && (m.status === "in-progress" || m.status === "overdue"));

  setState((current) => ({
    ...current,
    maintenanceRecords: current.maintenanceRecords.map((m) => (m.id === maintenanceId ? { ...m, status: "completed", completedDate: now.slice(0, 10), ...completion } : m)),
    vehicles: current.vehicles.map((v) => {
      if (v.id !== record.vehicleId) return v;
      const odometerKm = completion.odometerKm ?? v.odometerKm;
      return stillInMaintenance ? { ...v, odometerKm, updatedAt: now } : { ...v, odometerKm, status: "available", updatedAt: now };
    }),
  }));

  const vehicle = db.vehicles.find((v) => v.id === record.vehicleId);
  logTransportAudit({ subjectId: record.vehicleId, action: "maintenance-completed", actorName: actor.name, actorRole: actor.role, summary: `Maintenance completed for ${vehicle?.registrationNumber ?? record.vehicleId}.` });
  return { ok: true };
}

export function addMaintenancePart(draft: Omit<MaintenancePart, "id">, actor: Actor): Result & { part?: MaintenancePart } {
  const db = getSnapshot();
  const record = db.maintenanceRecords.find((m) => m.id === draft.maintenanceId);
  if (!record) return { ok: false, error: "Maintenance record not found." };

  const part: MaintenancePart = { ...draft, id: generateId("mpart") };
  setState((current) => ({ ...current, maintenanceRecords: current.maintenanceRecords.map((m) => (m.id === draft.maintenanceId ? { ...m, parts: [...m.parts, part] } : m)) }));
  logTransportAudit({ subjectId: record.vehicleId, action: "maintenance-created", actorName: actor.name, actorRole: actor.role, summary: `Part "${part.name}" (x${part.quantity}) recorded for maintenance ${draft.maintenanceId}.` });
  return { ok: true, part };
}
