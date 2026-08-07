import { getSnapshot, setState } from "@/lib/data/store";
import type { Vehicle, VehicleDocument, VehicleStatus } from "@/lib/types/transport";
import { buildSeatsForVehicle } from "@/lib/selectors/vehicle-seating";
import { generateId } from "@/lib/utils";
import { logTransportAudit } from "./transport-audit-service";

type Actor = { name: string; role: string };
type Result = { ok: true } | { ok: false; error: string };

export type VehicleDraft = Omit<Vehicle, "id" | "status" | "createdAt" | "updatedAt">;

function isDuplicateRegistration(registrationNumber: string, excludeId?: string): boolean {
  const db = getSnapshot();
  return db.vehicles.some((v) => v.id !== excludeId && v.registrationNumber.toLowerCase() === registrationNumber.trim().toLowerCase());
}

export function createVehicle(draft: VehicleDraft, actor: Actor): Result & { vehicle?: Vehicle } {
  if (isDuplicateRegistration(draft.registrationNumber)) return { ok: false, error: `A vehicle with registration "${draft.registrationNumber}" already exists.` };

  const now = new Date().toISOString();
  const vehicle: Vehicle = { ...draft, id: generateId("vehicle"), status: "available", createdAt: now, updatedAt: now };
  const seats = buildSeatsForVehicle(vehicle);

  setState((db) => ({ ...db, vehicles: [...db.vehicles, vehicle], vehicleSeats: [...db.vehicleSeats, ...seats] }));
  logTransportAudit({ subjectId: vehicle.id, action: "vehicle-created", actorName: actor.name, actorRole: actor.role, summary: `Vehicle ${vehicle.registrationNumber} (${vehicle.fleetNumber}) added.` });
  return { ok: true, vehicle };
}

export function updateVehicle(vehicleId: string, patch: Partial<VehicleDraft>, actor: Actor): Result {
  const db = getSnapshot();
  const vehicle = db.vehicles.find((v) => v.id === vehicleId);
  if (!vehicle) return { ok: false, error: "Vehicle not found." };
  if (patch.registrationNumber && isDuplicateRegistration(patch.registrationNumber, vehicleId)) {
    return { ok: false, error: `A vehicle with registration "${patch.registrationNumber}" already exists.` };
  }

  const now = new Date().toISOString();
  setState((current) => ({ ...current, vehicles: current.vehicles.map((v) => (v.id === vehicleId ? { ...v, ...patch, updatedAt: now } : v)) }));
  logTransportAudit({ subjectId: vehicleId, action: "vehicle-updated", actorName: actor.name, actorRole: actor.role, summary: `Vehicle ${vehicle.registrationNumber} updated.` });
  return { ok: true };
}

export function setVehicleStatus(vehicleId: string, status: VehicleStatus, actor: Actor, reason?: string): Result {
  const db = getSnapshot();
  const vehicle = db.vehicles.find((v) => v.id === vehicleId);
  if (!vehicle) return { ok: false, error: "Vehicle not found." };

  setState((current) => ({ ...current, vehicles: current.vehicles.map((v) => (v.id === vehicleId ? { ...v, status, updatedAt: new Date().toISOString() } : v)) }));
  logTransportAudit({ subjectId: vehicleId, action: "vehicle-updated", actorName: actor.name, actorRole: actor.role, summary: `Vehicle ${vehicle.registrationNumber} marked ${status}.`, reason });
  return { ok: true };
}

export type VehicleDocumentDraft = Omit<VehicleDocument, "id">;

export function addVehicleDocument(draft: VehicleDocumentDraft, actor: Actor): VehicleDocument {
  const document: VehicleDocument = { ...draft, id: generateId("vdoc") };
  setState((db) => ({ ...db, vehicleDocuments: [...db.vehicleDocuments, document] }));
  const vehicle = getSnapshot().vehicles.find((v) => v.id === draft.vehicleId);
  logTransportAudit({ subjectId: draft.vehicleId, action: "document-updated", actorName: actor.name, actorRole: actor.role, summary: `${document.type.replace(/-/g, " ")} document added for ${vehicle?.registrationNumber ?? draft.vehicleId}.` });
  return document;
}

export function updateVehicleDocument(documentId: string, patch: Partial<VehicleDocumentDraft>, actor: Actor): Result {
  const db = getSnapshot();
  const document = db.vehicleDocuments.find((d) => d.id === documentId);
  if (!document) return { ok: false, error: "Document not found." };

  setState((current) => ({ ...current, vehicleDocuments: current.vehicleDocuments.map((d) => (d.id === documentId ? { ...d, ...patch } : d)) }));
  const vehicle = db.vehicles.find((v) => v.id === document.vehicleId);
  logTransportAudit({ subjectId: document.vehicleId, action: "document-updated", actorName: actor.name, actorRole: actor.role, summary: `${document.type.replace(/-/g, " ")} document updated for ${vehicle?.registrationNumber ?? document.vehicleId}.` });
  return { ok: true };
}
