import { getSnapshot, setState } from "@/lib/data/store";
import type { IncidentStatus, TransportIncident } from "@/lib/types/transport";
import { generateId } from "@/lib/utils";
import { logTransportAudit } from "./transport-audit-service";

type Actor = { name: string; role: string };
type Result = { ok: true } | { ok: false; error: string };

export type IncidentDraft = Omit<TransportIncident, "id" | "incidentNumber" | "status" | "createdAt" | "updatedAt">;

function nextIncidentNumber(db: ReturnType<typeof getSnapshot>): string {
  const year = new Date().getFullYear();
  const countThisYear = db.transportIncidents.filter((i) => i.incidentNumber.includes(String(year))).length;
  return `INC-${year}-${String(countThisYear + 1).padStart(4, "0")}`;
}

export function reportIncident(draft: IncidentDraft, actor: Actor): TransportIncident {
  const db = getSnapshot();
  const now = new Date().toISOString();
  const incident: TransportIncident = { ...draft, id: generateId("incident"), incidentNumber: nextIncidentNumber(db), status: "open", createdAt: now, updatedAt: now };

  setState((current) => ({ ...current, transportIncidents: [...current.transportIncidents, incident] }));
  logTransportAudit({ subjectId: incident.id, action: "incident-reported", actorName: actor.name, actorRole: actor.role, summary: `Incident ${incident.incidentNumber} reported: ${incident.type.replace(/-/g, " ")} (${incident.severity}).`, tripId: incident.tripId });
  return incident;
}

export function updateIncidentStatus(incidentId: string, status: IncidentStatus, actor: Actor, resolution?: string): Result {
  const db = getSnapshot();
  const incident = db.transportIncidents.find((i) => i.id === incidentId);
  if (!incident) return { ok: false, error: "Incident not found." };

  setState((current) => ({ ...current, transportIncidents: current.transportIncidents.map((i) => (i.id === incidentId ? { ...i, status, resolution: resolution ?? i.resolution, updatedAt: new Date().toISOString() } : i)) }));
  logTransportAudit({ subjectId: incident.id, action: "incident-updated", actorName: actor.name, actorRole: actor.role, summary: `Incident ${incident.incidentNumber} marked ${status}.`, tripId: incident.tripId });
  return { ok: true };
}

export function updateIncident(incidentId: string, patch: Partial<IncidentDraft>, actor: Actor): Result {
  const db = getSnapshot();
  const incident = db.transportIncidents.find((i) => i.id === incidentId);
  if (!incident) return { ok: false, error: "Incident not found." };

  setState((current) => ({ ...current, transportIncidents: current.transportIncidents.map((i) => (i.id === incidentId ? { ...i, ...patch, updatedAt: new Date().toISOString() } : i)) }));
  logTransportAudit({ subjectId: incident.id, action: "incident-updated", actorName: actor.name, actorRole: actor.role, summary: `Incident ${incident.incidentNumber} updated.`, tripId: incident.tripId });
  return { ok: true };
}
