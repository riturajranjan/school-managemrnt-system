import { getSnapshot, setState } from "@/lib/data/store";
import type { Attendant, AttendantStatus } from "@/lib/types/transport";
import { generateId } from "@/lib/utils";
import { logTransportAudit } from "./transport-audit-service";

type Actor = { name: string; role: string };
type Result = { ok: true } | { ok: false; error: string };

export type AttendantDraft = Omit<Attendant, "id" | "status" | "createdAt" | "updatedAt">;

export function createAttendant(draft: AttendantDraft, actor: Actor): Attendant {
  const now = new Date().toISOString();
  const attendant: Attendant = { ...draft, id: generateId("attendant"), status: "available", createdAt: now, updatedAt: now };
  setState((db) => ({ ...db, attendants: [...db.attendants, attendant] }));
  logTransportAudit({ subjectId: attendant.id, action: "attendant-assigned", actorName: actor.name, actorRole: actor.role, summary: `Attendant ${attendant.name} (${attendant.employeeCode}) added.` });
  return attendant;
}

export function updateAttendant(attendantId: string, patch: Partial<AttendantDraft>, actor: Actor): Result {
  const db = getSnapshot();
  const attendant = db.attendants.find((a) => a.id === attendantId);
  if (!attendant) return { ok: false, error: "Attendant not found." };

  setState((current) => ({ ...current, attendants: current.attendants.map((a) => (a.id === attendantId ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a)) }));
  logTransportAudit({ subjectId: attendantId, action: "attendant-assigned", actorName: actor.name, actorRole: actor.role, summary: `Attendant ${attendant.name} updated.` });
  return { ok: true };
}

export function setAttendantStatus(attendantId: string, status: AttendantStatus, actor: Actor): Result {
  const db = getSnapshot();
  const attendant = db.attendants.find((a) => a.id === attendantId);
  if (!attendant) return { ok: false, error: "Attendant not found." };

  setState((current) => ({ ...current, attendants: current.attendants.map((a) => (a.id === attendantId ? { ...a, status, updatedAt: new Date().toISOString() } : a)) }));
  logTransportAudit({ subjectId: attendantId, action: "attendant-assigned", actorName: actor.name, actorRole: actor.role, summary: `Attendant ${attendant.name} marked ${status}.` });
  return { ok: true };
}
