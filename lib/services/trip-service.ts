import { getSnapshot, setState } from "@/lib/data/store";
import type { TransportTrip, TripStatus, TripStop, TripStudent } from "@/lib/types/transport";
import { generateId } from "@/lib/utils";
import { logTransportAudit } from "./transport-audit-service";

type Actor = { name: string; role: string };
type Result = { ok: true } | { ok: false; error: string };

function nextTripNumber(date: string, count: number): string {
  return `TRIP-${date.replace(/-/g, "")}-${String(count + 1).padStart(2, "0")}`;
}

/** Creates a scheduled trip for a route on a given date, seeding its stop
 * timeline from the route's stops and its student roster from every active
 * assignment on that route — a trip is never created empty by mistake. */
export function createTripForRoute(routeId: string, date: string, actor: Actor): Result & { trip?: TransportTrip } {
  const db = getSnapshot();
  const route = db.transportRoutes.find((r) => r.id === routeId);
  if (!route) return { ok: false, error: "Route not found." };
  if (route.status !== "active") return { ok: false, error: `Route "${route.name}" is not active.` };
  if (!route.assignedVehicleId || !route.primaryDriverId) return { ok: false, error: "Route must have a vehicle and driver assigned before a trip can be created." };
  if (db.transportTrips.some((t) => t.routeId === routeId && t.date === date && t.status !== "cancelled")) {
    return { ok: false, error: `A trip for "${route.name}" on ${date} already exists.` };
  }

  const routeStops = db.routeStops.filter((rs) => rs.routeId === routeId).sort((a, b) => a.sequence - b.sequence);
  const assignments = db.studentTransportAssignments.filter((a) => a.routeId === routeId && a.status === "active");

  const trip: TransportTrip = {
    id: generateId("trip"),
    tripNumber: nextTripNumber(date, db.transportTrips.filter((t) => t.date === date).length),
    routeId,
    direction: route.direction === "both" ? "pickup" : route.direction,
    date,
    shift: route.shift,
    vehicleId: route.assignedVehicleId,
    driverId: route.primaryDriverId,
    attendantId: route.attendantId,
    plannedStart: `${date}T${routeStops[0]?.pickupTime ?? "07:00"}:00.000Z`,
    plannedEnd: `${date}T${routeStops[routeStops.length - 1]?.dropTime ?? "08:00"}:00.000Z`,
    studentsExpected: assignments.length,
    studentsBoarded: 0,
    studentsDropped: 0,
    distanceKm: route.distanceKm,
    status: "scheduled",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const tripStops: TripStop[] = routeStops.map((rs, i) => ({
    id: generateId("tstop"),
    tripId: trip.id,
    stopId: rs.stopId,
    sequence: i + 1,
    plannedArrival: `${date}T${rs.pickupTime ?? "07:00"}:00.000Z`,
    plannedDeparture: `${date}T${rs.dropTime ?? "07:05"}:00.000Z`,
    status: "pending",
  }));

  const tripStudents: TripStudent[] = assignments.map((a) => ({ id: generateId("tstu"), tripId: trip.id, studentId: a.studentId, stopId: a.pickupStopId, pickupStatus: "expected", dropStatus: "not-confirmed" }));

  setState((current) => ({ ...current, transportTrips: [...current.transportTrips, trip], tripStops: [...current.tripStops, ...tripStops], tripStudents: [...current.tripStudents, ...tripStudents] }));
  logTransportAudit({ subjectId: trip.id, action: "trip-started", actorName: actor.name, actorRole: actor.role, summary: `Trip ${trip.tripNumber} created for route "${route.name}".`, tripId: trip.id });
  return { ok: true, trip };
}

const activatingStatuses = new Set<TripStatus>(["ready", "boarding", "in-progress"]);

export function setTripStatus(tripId: string, status: TripStatus, actor: Actor, reason?: string): Result {
  const db = getSnapshot();
  const trip = db.transportTrips.find((t) => t.id === tripId);
  if (!trip) return { ok: false, error: "Trip not found." };

  const now = new Date().toISOString();
  const isCompleting = status === "completed";

  setState((current) => ({
    ...current,
    transportTrips: current.transportTrips.map((t) => (t.id === tripId ? { ...t, status, updatedAt: now, actualStart: t.actualStart ?? (activatingStatuses.has(status) ? now : t.actualStart), actualEnd: isCompleting ? now : t.actualEnd } : t)),
  }));

  const action = status === "completed" ? "trip-completed" : status === "cancelled" ? "trip-cancelled" : "trip-started";
  logTransportAudit({ subjectId: tripId, action, actorName: actor.name, actorRole: actor.role, summary: `Trip ${trip.tripNumber} marked ${status}.`, reason, tripId });
  return { ok: true };
}

export function markTripStopStatus(tripStopId: string, status: TripStop["status"], actor: Actor): Result {
  const db = getSnapshot();
  const tripStop = db.tripStops.find((s) => s.id === tripStopId);
  if (!tripStop) return { ok: false, error: "Trip stop not found." };

  const now = new Date().toISOString();
  setState((current) => ({
    ...current,
    tripStops: current.tripStops.map((s) => (s.id === tripStopId ? { ...s, status, actualArrival: status === "arrived" ? now : s.actualArrival, actualDeparture: status === "departed" ? now : s.actualDeparture } : s)),
  }));

  const trip = db.transportTrips.find((t) => t.id === tripStop.tripId);
  const stop = db.transportStops.find((s) => s.id === tripStop.stopId);
  logTransportAudit({ subjectId: tripStop.tripId, action: "trip-started", actorName: actor.name, actorRole: actor.role, summary: `Stop "${stop?.name ?? tripStop.stopId}" on trip ${trip?.tripNumber ?? tripStop.tripId} marked ${status}.`, tripId: tripStop.tripId });
  return { ok: true };
}
