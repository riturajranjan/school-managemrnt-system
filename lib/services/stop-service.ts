import { getSnapshot, setState } from "@/lib/data/store";
import type { StopStatus, TransportStop } from "@/lib/types/transport";
import { generateId } from "@/lib/utils";
import { logTransportAudit } from "./transport-audit-service";

type Actor = { name: string; role: string };
type Result = { ok: true } | { ok: false; error: string };

export type StopDraft = Omit<TransportStop, "id" | "createdAt" | "updatedAt">;

function isDuplicateCode(code: string, excludeId?: string): boolean {
  const db = getSnapshot();
  return db.transportStops.some((s) => s.id !== excludeId && s.code.toLowerCase() === code.trim().toLowerCase());
}

export function createStop(draft: StopDraft, actor: Actor): Result & { stop?: TransportStop } {
  if (isDuplicateCode(draft.code)) return { ok: false, error: `A stop with code "${draft.code}" already exists.` };

  const now = new Date().toISOString();
  const stop: TransportStop = { ...draft, id: generateId("stop"), createdAt: now, updatedAt: now };
  setState((db) => ({ ...db, transportStops: [...db.transportStops, stop] }));
  logTransportAudit({ subjectId: stop.id, action: "stop-changed", actorName: actor.name, actorRole: actor.role, summary: `Stop "${stop.name}" created.` });
  return { ok: true, stop };
}

export function updateStop(stopId: string, patch: Partial<StopDraft>, actor: Actor): Result {
  const db = getSnapshot();
  const stop = db.transportStops.find((s) => s.id === stopId);
  if (!stop) return { ok: false, error: "Stop not found." };
  if (patch.code && isDuplicateCode(patch.code, stopId)) return { ok: false, error: `A stop with code "${patch.code}" already exists.` };

  setState((current) => ({ ...current, transportStops: current.transportStops.map((s) => (s.id === stopId ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s)) }));
  logTransportAudit({ subjectId: stopId, action: "stop-changed", actorName: actor.name, actorRole: actor.role, summary: `Stop "${stop.name}" updated.` });
  return { ok: true };
}

export function setStopStatus(stopId: string, status: StopStatus, actor: Actor, reason?: string): Result {
  const db = getSnapshot();
  const stop = db.transportStops.find((s) => s.id === stopId);
  if (!stop) return { ok: false, error: "Stop not found." };

  setState((current) => ({ ...current, transportStops: current.transportStops.map((s) => (s.id === stopId ? { ...s, status, updatedAt: new Date().toISOString() } : s)) }));
  logTransportAudit({ subjectId: stopId, action: "stop-changed", actorName: actor.name, actorRole: actor.role, summary: `Stop "${stop.name}" marked ${status}.`, reason });
  return { ok: true };
}

export function flagUnsafeStop(stopId: string, safetyNotes: string, actor: Actor): Result {
  const db = getSnapshot();
  const stop = db.transportStops.find((s) => s.id === stopId);
  if (!stop) return { ok: false, error: "Stop not found." };

  setState((current) => ({ ...current, transportStops: current.transportStops.map((s) => (s.id === stopId ? { ...s, status: "unsafe", safetyNotes, updatedAt: new Date().toISOString() } : s)) }));
  logTransportAudit({ subjectId: stopId, action: "stop-changed", actorName: actor.name, actorRole: actor.role, summary: `Stop "${stop.name}" flagged unsafe.`, reason: safetyNotes });
  return { ok: true };
}

export function setAlternateStop(stopId: string, alternateStopId: string, actor: Actor): Result {
  const db = getSnapshot();
  const stop = db.transportStops.find((s) => s.id === stopId);
  const alternate = db.transportStops.find((s) => s.id === alternateStopId);
  if (!stop) return { ok: false, error: "Stop not found." };
  if (!alternate) return { ok: false, error: "Alternate stop not found." };

  setState((current) => ({ ...current, transportStops: current.transportStops.map((s) => (s.id === stopId ? { ...s, alternateStopId, updatedAt: new Date().toISOString() } : s)) }));
  logTransportAudit({ subjectId: stopId, action: "stop-changed", actorName: actor.name, actorRole: actor.role, summary: `Alternate stop for "${stop.name}" set to "${alternate.name}".` });
  return { ok: true };
}
