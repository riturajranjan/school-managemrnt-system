import { getSnapshot, setState } from "@/lib/data/store";
import type { Driver, DriverAvailability, DriverAvailabilityStatus, DriverDocument, DriverStatus, DriverTraining } from "@/lib/types/transport";
import { generateId } from "@/lib/utils";
import { logTransportAudit } from "./transport-audit-service";

type Actor = { name: string; role: string };
type Result = { ok: true } | { ok: false; error: string };

export type DriverDraft = Omit<Driver, "id" | "status" | "createdAt" | "updatedAt">;

function isDuplicateLicense(licenseNumber: string, excludeId?: string): boolean {
  const db = getSnapshot();
  return db.drivers.some((d) => d.id !== excludeId && d.licenseNumber.toLowerCase() === licenseNumber.trim().toLowerCase());
}

export function createDriver(draft: DriverDraft, actor: Actor): Result & { driver?: Driver } {
  if (isDuplicateLicense(draft.licenseNumber)) return { ok: false, error: `A driver with license "${draft.licenseNumber}" already exists.` };

  const now = new Date().toISOString();
  const driver: Driver = { ...draft, id: generateId("driver"), status: "available", createdAt: now, updatedAt: now };
  setState((db) => ({ ...db, drivers: [...db.drivers, driver] }));
  logTransportAudit({ subjectId: driver.id, action: "driver-assigned", actorName: actor.name, actorRole: actor.role, summary: `Driver ${driver.name} (${driver.employeeCode}) added.` });
  return { ok: true, driver };
}

export function updateDriver(driverId: string, patch: Partial<DriverDraft>, actor: Actor): Result {
  const db = getSnapshot();
  const driver = db.drivers.find((d) => d.id === driverId);
  if (!driver) return { ok: false, error: "Driver not found." };
  if (patch.licenseNumber && isDuplicateLicense(patch.licenseNumber, driverId)) return { ok: false, error: `A driver with license "${patch.licenseNumber}" already exists.` };

  setState((current) => ({ ...current, drivers: current.drivers.map((d) => (d.id === driverId ? { ...d, ...patch, updatedAt: new Date().toISOString() } : d)) }));
  logTransportAudit({ subjectId: driverId, action: "driver-assigned", actorName: actor.name, actorRole: actor.role, summary: `Driver ${driver.name} updated.` });
  return { ok: true };
}

export function setDriverStatus(driverId: string, status: DriverStatus, actor: Actor, reason?: string): Result {
  const db = getSnapshot();
  const driver = db.drivers.find((d) => d.id === driverId);
  if (!driver) return { ok: false, error: "Driver not found." };

  setState((current) => ({ ...current, drivers: current.drivers.map((d) => (d.id === driverId ? { ...d, status, updatedAt: new Date().toISOString() } : d)) }));
  logTransportAudit({ subjectId: driverId, action: "driver-assigned", actorName: actor.name, actorRole: actor.role, summary: `Driver ${driver.name} marked ${status}.`, reason });
  return { ok: true };
}

export type DriverDocumentDraft = Omit<DriverDocument, "id">;

export function addDriverDocument(draft: DriverDocumentDraft, actor: Actor): DriverDocument {
  const document: DriverDocument = { ...draft, id: generateId("ddoc") };
  setState((db) => ({ ...db, driverDocuments: [...db.driverDocuments, document] }));
  const driver = getSnapshot().drivers.find((d) => d.id === draft.driverId);
  logTransportAudit({ subjectId: draft.driverId, action: "document-updated", actorName: actor.name, actorRole: actor.role, summary: `${document.type.replace(/-/g, " ")} document added for ${driver?.name ?? draft.driverId}.` });
  return document;
}

export function updateDriverDocument(documentId: string, patch: Partial<DriverDocumentDraft>, actor: Actor): Result {
  const db = getSnapshot();
  const document = db.driverDocuments.find((d) => d.id === documentId);
  if (!document) return { ok: false, error: "Document not found." };

  setState((current) => ({ ...current, driverDocuments: current.driverDocuments.map((d) => (d.id === documentId ? { ...d, ...patch } : d)) }));
  const driver = db.drivers.find((d) => d.id === document.driverId);
  logTransportAudit({ subjectId: document.driverId, action: "document-updated", actorName: actor.name, actorRole: actor.role, summary: `${document.type.replace(/-/g, " ")} document updated for ${driver?.name ?? document.driverId}.` });
  return { ok: true };
}

export function addDriverTraining(draft: Omit<DriverTraining, "id">, actor: Actor): DriverTraining {
  const training: DriverTraining = { ...draft, id: generateId("dtrain") };
  setState((db) => ({ ...db, driverTraining: [...db.driverTraining, training] }));
  const driver = getSnapshot().drivers.find((d) => d.id === draft.driverId);
  logTransportAudit({ subjectId: draft.driverId, action: "driver-assigned", actorName: actor.name, actorRole: actor.role, summary: `Training "${training.title}" recorded for ${driver?.name ?? draft.driverId}.` });
  return training;
}

export function setDriverAvailability(driverId: string, date: string, status: DriverAvailabilityStatus, actor: Actor, reason?: string): DriverAvailability {
  const record: DriverAvailability = { id: generateId("davail"), driverId, date, status, reason };
  setState((db) => ({ ...db, driverAvailability: [...db.driverAvailability.filter((a) => !(a.driverId === driverId && a.date === date)), record] }));
  const driver = getSnapshot().drivers.find((d) => d.id === driverId);
  logTransportAudit({ subjectId: driverId, action: "driver-assigned", actorName: actor.name, actorRole: actor.role, summary: `Availability for ${driver?.name ?? driverId} on ${date} set to ${status}.`, reason });
  return record;
}
