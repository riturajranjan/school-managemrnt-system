import { getSnapshot, setState } from "@/lib/data/store";
import { logTransportAudit } from "./transport-audit-service";

type Actor = { name: string; role: string };
type Result = { ok: true } | { ok: false; error: string };

export function reserveSeat(seatId: string, actor: Actor): Result {
  const db = getSnapshot();
  const seat = db.vehicleSeats.find((s) => s.id === seatId);
  if (!seat) return { ok: false, error: "Seat not found." };
  if (seat.studentId) return { ok: false, error: "Seat is already assigned to a student — clear it first." };

  setState((current) => ({ ...current, vehicleSeats: current.vehicleSeats.map((s) => (s.id === seatId ? { ...s, type: "reserved" } : s)) }));
  logTransportAudit({ subjectId: seat.vehicleId, action: "vehicle-updated", actorName: actor.name, actorRole: actor.role, summary: `Seat ${seat.seatNumber} on vehicle ${seat.vehicleId} reserved.` });
  return { ok: true };
}

export function blockSeat(seatId: string, actor: Actor, reason?: string): Result {
  const db = getSnapshot();
  const seat = db.vehicleSeats.find((s) => s.id === seatId);
  if (!seat) return { ok: false, error: "Seat not found." };
  if (seat.studentId) return { ok: false, error: "Seat is already assigned to a student — clear it first." };

  setState((current) => ({ ...current, vehicleSeats: current.vehicleSeats.map((s) => (s.id === seatId ? { ...s, type: "unavailable" } : s)) }));
  logTransportAudit({ subjectId: seat.vehicleId, action: "vehicle-updated", actorName: actor.name, actorRole: actor.role, summary: `Seat ${seat.seatNumber} on vehicle ${seat.vehicleId} blocked.`, reason });
  return { ok: true };
}

export function clearSeat(seatId: string, actor: Actor): Result {
  const db = getSnapshot();
  const seat = db.vehicleSeats.find((s) => s.id === seatId);
  if (!seat) return { ok: false, error: "Seat not found." };

  setState((current) => ({
    ...current,
    vehicleSeats: current.vehicleSeats.map((s) => (s.id === seatId ? { ...s, studentId: undefined, routeId: undefined, type: s.type === "unavailable" || s.type === "reserved" ? "standard" : s.type } : s)),
    studentTransportAssignments: seat.studentId ? current.studentTransportAssignments.map((a) => (a.seatId === seatId ? { ...a, seatId: undefined } : a)) : current.studentTransportAssignments,
  }));
  logTransportAudit({ subjectId: seat.vehicleId, action: "vehicle-updated", actorName: actor.name, actorRole: actor.role, summary: `Seat ${seat.seatNumber} on vehicle ${seat.vehicleId} cleared.` });
  return { ok: true };
}

/** Moves an already-seated student to a different, currently-empty standard
 * seat on the same vehicle — used from the seating chart, distinct from the
 * full assignment workflow since the route/stop don't change. */
export function moveStudentSeat(fromSeatId: string, toSeatId: string, actor: Actor): Result {
  const db = getSnapshot();
  const fromSeat = db.vehicleSeats.find((s) => s.id === fromSeatId);
  const toSeat = db.vehicleSeats.find((s) => s.id === toSeatId);
  if (!fromSeat || !toSeat) return { ok: false, error: "Seat not found." };
  if (!fromSeat.studentId) return { ok: false, error: "Source seat has no assigned student." };
  if (toSeat.studentId) return { ok: false, error: "Destination seat is already occupied." };
  if (fromSeat.vehicleId !== toSeat.vehicleId) return { ok: false, error: "Seats must be on the same vehicle." };

  const studentId = fromSeat.studentId;
  const routeId = fromSeat.routeId;
  setState((current) => ({
    ...current,
    vehicleSeats: current.vehicleSeats.map((s) => {
      if (s.id === fromSeatId) return { ...s, studentId: undefined, routeId: undefined };
      if (s.id === toSeatId) return { ...s, studentId, routeId };
      return s;
    }),
    studentTransportAssignments: current.studentTransportAssignments.map((a) => (a.seatId === fromSeatId ? { ...a, seatId: toSeatId } : a)),
  }));
  logTransportAudit({ subjectId: studentId, action: "vehicle-updated", actorName: actor.name, actorRole: actor.role, summary: `Student moved from seat ${fromSeat.seatNumber} to ${toSeat.seatNumber} on vehicle ${fromSeat.vehicleId}.` });
  return { ok: true };
}

export function assignStudentToSeat(seatId: string, studentId: string, routeId: string, actor: Actor): Result {
  const db = getSnapshot();
  const seat = db.vehicleSeats.find((s) => s.id === seatId);
  if (!seat) return { ok: false, error: "Seat not found." };
  if (seat.studentId) return { ok: false, error: "Seat is already occupied." };
  if (seat.type === "unavailable") return { ok: false, error: "Seat is blocked." };

  setState((current) => ({
    ...current,
    vehicleSeats: current.vehicleSeats.map((s) => (s.id === seatId ? { ...s, studentId, routeId } : s)),
    studentTransportAssignments: current.studentTransportAssignments.map((a) => (a.studentId === studentId && a.status === "active" ? { ...a, seatId } : a)),
  }));
  logTransportAudit({ subjectId: studentId, action: "vehicle-updated", actorName: actor.name, actorRole: actor.role, summary: `Student assigned to seat ${seat.seatNumber} on vehicle ${seat.vehicleId}.` });
  return { ok: true };
}
