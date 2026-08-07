import { getSnapshot, setState } from "@/lib/data/store";
import type { StaffTransportAssignment, TransportAssignmentStatus } from "@/lib/types/transport";
import { generateId } from "@/lib/utils";
import { logTransportAudit } from "./transport-audit-service";

type Actor = { name: string; role: string };
type Result = { ok: true } | { ok: false; error: string };

export type StaffAssignmentDraft = Omit<StaffTransportAssignment, "id" | "status" | "createdAt">;

export function assignStaffTransport(draft: StaffAssignmentDraft, actor: Actor): Result & { assignment?: StaffTransportAssignment } {
  const db = getSnapshot();
  const route = db.transportRoutes.find((r) => r.id === draft.routeId);
  if (!route) return { ok: false, error: "Route not found." };
  if (db.staffTransportAssignments.some((a) => a.staffId === draft.staffId && a.status === "active")) {
    return { ok: false, error: `${draft.staffName} already has an active transport assignment.` };
  }

  const assignment: StaffTransportAssignment = { ...draft, id: generateId("staffta"), status: "active", createdAt: new Date().toISOString() };
  setState((current) => ({ ...current, staffTransportAssignments: [...current.staffTransportAssignments, assignment] }));
  logTransportAudit({ subjectId: draft.staffId, action: "student-assigned", actorName: actor.name, actorRole: actor.role, summary: `${draft.staffName} assigned to route "${route.name}".` });
  return { ok: true, assignment };
}

export function setStaffAssignmentStatus(assignmentId: string, status: TransportAssignmentStatus, actor: Actor, reason?: string): Result {
  const db = getSnapshot();
  const assignment = db.staffTransportAssignments.find((a) => a.id === assignmentId);
  if (!assignment) return { ok: false, error: "Assignment not found." };

  setState((current) => ({ ...current, staffTransportAssignments: current.staffTransportAssignments.map((a) => (a.id === assignmentId ? { ...a, status } : a)) }));
  logTransportAudit({ subjectId: assignment.staffId, action: "student-removed", actorName: actor.name, actorRole: actor.role, summary: `Transport for ${assignment.staffName} marked ${status}.`, reason });
  return { ok: true };
}
