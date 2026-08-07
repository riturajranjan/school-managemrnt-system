import { getSnapshot, setState, type Db } from "@/lib/data/store";
import type { RouteStatus, RouteStop, TransportRoute } from "@/lib/types/transport";
import { generateId } from "@/lib/utils";
import { logTransportAudit } from "./transport-audit-service";

type Actor = { name: string; role: string };
type Result = { ok: true } | { ok: false; error: string };

export type RouteDraft = Omit<TransportRoute, "id" | "createdAt" | "updatedAt" | "createdBy">;
export type RouteStopDraft = Omit<RouteStop, "id" | "routeId">;

/** Sequence/timing validation for a route's stop list — duplicate stops,
 * gaps in the sequence, and pickup times that run backwards along the
 * route (an "impossible time sequence"). */
export function validateRouteStops(db: Db, routeId: string): string[] {
  const errors: string[] = [];
  const stops = db.routeStops.filter((rs) => rs.routeId === routeId).sort((a, b) => a.sequence - b.sequence);

  const seen = new Set<string>();
  for (const rs of stops) {
    const stopName = db.transportStops.find((s) => s.id === rs.stopId)?.name ?? rs.stopId;
    if (seen.has(rs.stopId)) errors.push(`Stop "${stopName}" appears more than once on this route.`);
    seen.add(rs.stopId);
  }

  const sequences = stops.map((s) => s.sequence);
  const expected = stops.map((_, i) => i + 1);
  if (sequences.length > 0 && JSON.stringify(sequences) !== JSON.stringify(expected)) {
    errors.push("Stop sequence has gaps or duplicate positions — resequence before activating.");
  }

  for (let i = 1; i < stops.length; i++) {
    if (stops[i].pickupTime && stops[i - 1].pickupTime && stops[i].pickupTime! < stops[i - 1].pickupTime!) {
      errors.push(`Pickup time at stop ${i + 1} is earlier than the previous stop — impossible time sequence.`);
    }
  }

  return errors;
}

/** Route-level validation: duplicate active codes, capacity vs. assigned
 * vehicle, vehicle-type mismatch, driver double-booking in the same shift,
 * missing school endpoint, and invalid effective dates. Stop-sequence
 * checks live in validateRouteStops() since they need the route to already
 * exist (stops are added after the route shell is created). */
export function validateRoute(db: Db, draft: RouteDraft, excludeId?: string): string[] {
  const errors: string[] = [];

  if (draft.status === "active" && db.transportRoutes.some((r) => r.id !== excludeId && r.code.trim().toLowerCase() === draft.code.trim().toLowerCase() && r.status === "active")) {
    errors.push(`An active route with code "${draft.code}" already exists.`);
  }
  if (!draft.endPoint.trim()) errors.push("Route must have a school endpoint.");
  if (draft.effectiveTo && draft.effectiveTo < draft.effectiveFrom) errors.push("Effective-to date cannot be before the effective-from date.");
  if (draft.maxCapacity <= 0) errors.push("Maximum capacity must be greater than zero.");

  if (draft.assignedVehicleId) {
    const vehicle = db.vehicles.find((v) => v.id === draft.assignedVehicleId);
    if (!vehicle) {
      errors.push("Assigned vehicle not found.");
    } else {
      if (draft.maxCapacity > vehicle.capacity) errors.push(`Route capacity (${draft.maxCapacity}) exceeds the assigned vehicle's capacity (${vehicle.capacity}).`);
      if (vehicle.type !== draft.vehicleType) errors.push(`Assigned vehicle type (${vehicle.type}) doesn't match the route's required vehicle type (${draft.vehicleType}).`);
    }
  }

  if (draft.primaryDriverId) {
    const conflict = db.transportRoutes.find((r) => r.id !== excludeId && r.status === "active" && (r.shift === draft.shift || r.shift === "both" || draft.shift === "both") && (r.primaryDriverId === draft.primaryDriverId || r.backupDriverId === draft.primaryDriverId));
    if (conflict) errors.push(`Primary driver is already assigned to route "${conflict.name}" in an overlapping shift.`);
  }

  if (excludeId) {
    const activeAssignments = db.studentTransportAssignments.filter((a) => a.routeId === excludeId && a.status === "active").length;
    if (activeAssignments > draft.maxCapacity) errors.push(`This route already has ${activeAssignments} active student assignment(s), which exceeds the new capacity of ${draft.maxCapacity}.`);
  }

  return errors;
}

function nextRouteCode(db: Db): string {
  const maxSeq = db.transportRoutes.reduce((max, r) => {
    const match = r.code.match(/(\d+)$/);
    const seq = match ? Number(match[1]) : 0;
    return seq > max ? seq : max;
  }, 0);
  return `RT-${String(maxSeq + 1).padStart(2, "0")}`;
}

export function createRoute(draft: Omit<RouteDraft, "code"> & { code?: string }, actor: Actor): Result & { route?: TransportRoute } {
  const db = getSnapshot();
  const code = draft.code?.trim() || nextRouteCode(db);
  const full: RouteDraft = { ...draft, code };
  const errors = validateRoute(db, full);
  if (errors.length > 0) return { ok: false, error: errors.join(" ") };

  const now = new Date().toISOString();
  const route: TransportRoute = { ...full, id: generateId("route"), createdBy: actor.name, createdAt: now, updatedAt: now };
  setState((current) => ({ ...current, transportRoutes: [...current.transportRoutes, route] }));
  logTransportAudit({ subjectId: route.id, action: "route-created", actorName: actor.name, actorRole: actor.role, summary: `Route "${route.name}" (${route.code}) created.` });
  return { ok: true, route };
}

export function updateRoute(routeId: string, patch: Partial<RouteDraft>, actor: Actor): Result {
  const db = getSnapshot();
  const route = db.transportRoutes.find((r) => r.id === routeId);
  if (!route) return { ok: false, error: "Route not found." };

  const merged: RouteDraft = { ...route, ...patch };
  const errors = validateRoute(db, merged, routeId);
  if (errors.length > 0) return { ok: false, error: errors.join(" ") };

  setState((current) => ({ ...current, transportRoutes: current.transportRoutes.map((r) => (r.id === routeId ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r)) }));
  logTransportAudit({ subjectId: routeId, action: "route-updated", actorName: actor.name, actorRole: actor.role, summary: `Route "${route.name}" updated.` });
  return { ok: true };
}

export function setRouteStatus(routeId: string, status: RouteStatus, actor: Actor, reason?: string): Result {
  const db = getSnapshot();
  const route = db.transportRoutes.find((r) => r.id === routeId);
  if (!route) return { ok: false, error: "Route not found." };

  if (status === "active") {
    const routeErrors = validateRoute(db, { ...route, status }, routeId);
    const stopErrors = validateRouteStops(db, routeId);
    const errors = [...routeErrors, ...stopErrors];
    if (errors.length > 0) return { ok: false, error: errors.join(" ") };
  }

  setState((current) => ({ ...current, transportRoutes: current.transportRoutes.map((r) => (r.id === routeId ? { ...r, status, updatedAt: new Date().toISOString() } : r)) }));
  logTransportAudit({ subjectId: routeId, action: status === "archived" ? "route-archived" : "route-updated", actorName: actor.name, actorRole: actor.role, summary: `Route "${route.name}" marked ${status}.`, reason });
  return { ok: true };
}

export function addStopToRoute(routeId: string, stopDraft: RouteStopDraft, actor: Actor): Result & { routeStop?: RouteStop } {
  const db = getSnapshot();
  const route = db.transportRoutes.find((r) => r.id === routeId);
  if (!route) return { ok: false, error: "Route not found." };
  const stop = db.transportStops.find((s) => s.id === stopDraft.stopId);
  if (!stop) return { ok: false, error: "Stop not found." };
  if (db.routeStops.some((rs) => rs.routeId === routeId && rs.stopId === stopDraft.stopId)) {
    return { ok: false, error: `"${stop.name}" is already on this route.` };
  }

  const routeStop: RouteStop = { ...stopDraft, id: generateId("rstop"), routeId };
  setState((current) => ({ ...current, routeStops: [...current.routeStops, routeStop] }));
  logTransportAudit({ subjectId: routeId, action: "stop-changed", actorName: actor.name, actorRole: actor.role, summary: `Stop "${stop.name}" added to route "${route.name}".` });
  return { ok: true, routeStop };
}

export function removeStopFromRoute(routeStopId: string, actor: Actor): Result {
  const db = getSnapshot();
  const routeStop = db.routeStops.find((rs) => rs.id === routeStopId);
  if (!routeStop) return { ok: false, error: "Route stop not found." };
  const route = db.transportRoutes.find((r) => r.id === routeStop.routeId);
  const stop = db.transportStops.find((s) => s.id === routeStop.stopId);

  setState((current) => ({ ...current, routeStops: current.routeStops.filter((rs) => rs.id !== routeStopId) }));
  logTransportAudit({ subjectId: routeStop.routeId, action: "stop-changed", actorName: actor.name, actorRole: actor.role, summary: `Stop "${stop?.name ?? routeStop.stopId}" removed from route "${route?.name ?? routeStop.routeId}".` });
  return { ok: true };
}

export function reorderRouteStops(routeId: string, orderedStopIds: string[], actor: Actor): Result {
  const db = getSnapshot();
  const route = db.transportRoutes.find((r) => r.id === routeId);
  if (!route) return { ok: false, error: "Route not found." };

  setState((current) => ({
    ...current,
    routeStops: current.routeStops.map((rs) => {
      if (rs.routeId !== routeId) return rs;
      const sequence = orderedStopIds.indexOf(rs.stopId) + 1;
      return sequence > 0 ? { ...rs, sequence } : rs;
    }),
  }));
  logTransportAudit({ subjectId: routeId, action: "stop-changed", actorName: actor.name, actorRole: actor.role, summary: `Stop order updated for route "${route.name}".` });
  return { ok: true };
}
