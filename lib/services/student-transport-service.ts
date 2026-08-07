import { getSnapshot, setState, type Db } from "@/lib/data/store";
import type { StudentTransportAssignment, TransportAssignmentStatus } from "@/lib/types/transport";
import { generateId } from "@/lib/utils";
import { logTransportAudit } from "./transport-audit-service";
import { resolveFeeRuleForRoute } from "./transport-fee-service";

type Actor = { name: string; role: string };
type Result = { ok: true } | { ok: false; error: string };

export type StudentAssignmentDraft = Omit<StudentTransportAssignment, "id" | "status" | "createdBy" | "createdAt" | "updatedAt">;

/** Validates a student transport assignment before it's written — every
 * check the spec calls out: route must be active, pickup/drop stops must
 * actually be on the route, shift must match, no duplicate active
 * assignment for the same student+session, route/vehicle capacity, and no
 * seat double-booking. */
export function validateStudentAssignment(db: Db, draft: StudentAssignmentDraft, excludeId?: string): string[] {
  const errors: string[] = [];
  const route = db.transportRoutes.find((r) => r.id === draft.routeId);
  if (!route) {
    errors.push("Route not found.");
    return errors;
  }
  if (route.status !== "active") errors.push(`Route "${route.name}" is not active.`);

  const routeStopIds = new Set(db.routeStops.filter((rs) => rs.routeId === draft.routeId).map((rs) => rs.stopId));
  if (!routeStopIds.has(draft.pickupStopId)) errors.push("Pickup stop is not on the selected route.");
  if (!routeStopIds.has(draft.dropStopId)) errors.push("Drop stop is not on the selected route.");

  if (draft.shift !== route.shift && route.shift !== "both" && draft.shift !== "both") {
    errors.push(`Shift "${draft.shift}" doesn't match this route's shift ("${route.shift}").`);
  }

  const duplicateActive = db.studentTransportAssignments.find((a) => a.id !== excludeId && a.studentId === draft.studentId && a.session === draft.session && a.status === "active");
  if (duplicateActive) errors.push("This student already has an active transport assignment for this session.");

  const activeOnRoute = db.studentTransportAssignments.filter((a) => a.id !== excludeId && a.routeId === draft.routeId && a.status === "active").length;
  if (activeOnRoute >= route.maxCapacity) errors.push(`Route "${route.name}" is at capacity (${route.maxCapacity}).`);

  if (draft.seatId) {
    const seatTaken = db.vehicleSeats.find((s) => s.id === draft.seatId && s.studentId && s.studentId !== draft.studentId);
    if (seatTaken) errors.push("Selected seat is already assigned to another student.");
  }

  if (draft.effectiveTo && draft.effectiveTo < draft.effectiveFrom) errors.push("Effective-to date cannot be before the effective-from date.");

  return errors;
}

function syncStudentSummary(db: Db, studentId: string) {
  const active = db.studentTransportAssignments.find((a) => a.studentId === studentId && a.status === "active");
  return (state: Db["students"][number]) => {
    if (state.id !== studentId) return state;
    if (!active) return { ...state, transport: undefined };
    const route = db.transportRoutes.find((r) => r.id === active.routeId);
    const routeStop = db.routeStops.find((rs) => rs.routeId === active.routeId && rs.stopId === active.pickupStopId);
    const stop = db.transportStops.find((s) => s.id === active.pickupStopId);
    if (!route || !stop) return state;
    return { ...state, transport: { routeId: route.id, routeName: route.name, stopName: stop.name, pickupTime: routeStop?.pickupTime ?? "—", dropTime: routeStop?.dropTime ?? "—" } };
  };
}

export function assignStudentTransport(draft: StudentAssignmentDraft, actor: Actor): Result & { assignment?: StudentTransportAssignment } {
  const db = getSnapshot();
  const errors = validateStudentAssignment(db, draft);
  if (errors.length > 0) return { ok: false, error: errors.join(" ") };

  const now = new Date().toISOString();
  const feeRuleId = draft.feeRuleId ?? resolveFeeRuleForRoute(db, draft.routeId, draft.session)?.id;
  const assignment: StudentTransportAssignment = { ...draft, feeRuleId, id: generateId("sta"), status: "active", createdBy: actor.name, createdAt: now, updatedAt: now };

  setState((current) => {
    const withAssignment = { ...current, studentTransportAssignments: [...current.studentTransportAssignments, assignment], vehicleSeats: assignment.seatId ? current.vehicleSeats.map((s) => (s.id === assignment.seatId ? { ...s, studentId: assignment.studentId, routeId: assignment.routeId } : s)) : current.vehicleSeats };
    return { ...withAssignment, students: withAssignment.students.map(syncStudentSummary(withAssignment, assignment.studentId)) };
  });

  const student = db.students.find((s) => s.id === draft.studentId);
  const route = db.transportRoutes.find((r) => r.id === draft.routeId);
  logTransportAudit({ subjectId: draft.studentId, action: "student-assigned", actorName: actor.name, actorRole: actor.role, summary: `${student ? `${student.profile.firstName} ${student.profile.lastName}` : draft.studentId} assigned to route "${route?.name ?? draft.routeId}".` });
  return { ok: true, assignment };
}

export function updateStudentAssignment(assignmentId: string, patch: Partial<StudentAssignmentDraft>, actor: Actor): Result {
  const db = getSnapshot();
  const assignment = db.studentTransportAssignments.find((a) => a.id === assignmentId);
  if (!assignment) return { ok: false, error: "Assignment not found." };

  const merged: StudentAssignmentDraft = { ...assignment, ...patch };
  const errors = validateStudentAssignment(db, merged, assignmentId);
  if (errors.length > 0) return { ok: false, error: errors.join(" ") };

  setState((current) => {
    const updated = { ...current, studentTransportAssignments: current.studentTransportAssignments.map((a) => (a.id === assignmentId ? { ...a, ...patch, updatedAt: new Date().toISOString() } : a)) };
    return { ...updated, students: updated.students.map(syncStudentSummary(updated, assignment.studentId)) };
  });
  logTransportAudit({ subjectId: assignment.studentId, action: "student-assigned", actorName: actor.name, actorRole: actor.role, summary: `Transport assignment updated for student ${assignment.studentId}.` });
  return { ok: true };
}

function setAssignmentStatus(assignmentId: string, status: TransportAssignmentStatus, actor: Actor, reason?: string): Result {
  const db = getSnapshot();
  const assignment = db.studentTransportAssignments.find((a) => a.id === assignmentId);
  if (!assignment) return { ok: false, error: "Assignment not found." };

  setState((current) => {
    const updated = {
      ...current,
      studentTransportAssignments: current.studentTransportAssignments.map((a) => (a.id === assignmentId ? { ...a, status, updatedAt: new Date().toISOString() } : a)),
      vehicleSeats: status !== "active" && assignment.seatId ? current.vehicleSeats.map((s) => (s.id === assignment.seatId ? { ...s, studentId: undefined, routeId: undefined } : s)) : current.vehicleSeats,
    };
    return { ...updated, students: updated.students.map(syncStudentSummary(updated, assignment.studentId)) };
  });

  const student = db.students.find((s) => s.id === assignment.studentId);
  logTransportAudit({ subjectId: assignment.studentId, action: status === "withdrawn" ? "student-removed" : "student-assigned", actorName: actor.name, actorRole: actor.role, summary: `Transport for ${student ? `${student.profile.firstName} ${student.profile.lastName}` : assignment.studentId} marked ${status}.`, reason });
  return { ok: true };
}

export function withdrawStudentTransport(assignmentId: string, reason: string, actor: Actor): Result {
  return setAssignmentStatus(assignmentId, "withdrawn", actor, reason);
}

export function suspendStudentTransport(assignmentId: string, reason: string, actor: Actor): Result {
  return setAssignmentStatus(assignmentId, "suspended", actor, reason);
}

export function reactivateStudentTransport(assignmentId: string, actor: Actor): Result {
  const db = getSnapshot();
  const assignment = db.studentTransportAssignments.find((a) => a.id === assignmentId);
  if (!assignment) return { ok: false, error: "Assignment not found." };
  const errors = validateStudentAssignment(db, assignment, assignmentId);
  if (errors.length > 0) return { ok: false, error: errors.join(" ") };
  return setAssignmentStatus(assignmentId, "active", actor);
}

export type BulkAssignResult = { assigned: string[]; skipped: { studentId: string; reason: string }[] };

/** Assigns every given student to the same route/stop/shift in one pass —
 * never silently overbooks: each student is validated individually and
 * anyone who would break capacity or duplicate-assignment rules is skipped
 * with a reason rather than forced through. */
export function bulkAssignStudentsToRoute(studentIds: string[], routeId: string, pickupStopId: string, dropStopId: string, session: string, actor: Actor): BulkAssignResult {
  const db = getSnapshot();
  const route = db.transportRoutes.find((r) => r.id === routeId);
  const assigned: string[] = [];
  const skipped: { studentId: string; reason: string }[] = [];

  for (const studentId of studentIds) {
    const draft: StudentAssignmentDraft = { studentId, session, routeId, pickupStopId, dropStopId, shift: route?.shift ?? "morning", vehicleId: route?.assignedVehicleId, effectiveFrom: new Date().toISOString().slice(0, 10) };
    const result = assignStudentTransport(draft, actor);
    if (result.ok) assigned.push(studentId);
    else skipped.push({ studentId, reason: result.error });
  }

  logTransportAudit({ action: "student-assigned", actorName: actor.name, actorRole: actor.role, summary: `Bulk assignment to route "${route?.name ?? routeId}": ${assigned.length} assigned, ${skipped.length} skipped.` });
  return { assigned, skipped };
}
