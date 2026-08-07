import { getSnapshot, setState } from "@/lib/data/store";
import type { DropStatus, PickupStatus, VerificationMethod } from "@/lib/types/transport";
import { generateId } from "@/lib/utils";
import { logTransportAudit } from "./transport-audit-service";

type Actor = { name: string; role: string };
type Result = { ok: true } | { ok: false; error: string };

const boardedPickupStatuses = new Set<PickupStatus>(["boarded", "alternate-pickup"]);
const droppedStatuses = new Set<DropStatus>(["dropped"]);

function studentLabel(db: ReturnType<typeof getSnapshot>, studentId: string): string {
  const student = db.students.find((s) => s.id === studentId);
  return student ? `${student.profile.firstName} ${student.profile.lastName}` : studentId;
}

/** Marks one student's pickup status on a trip — writes the immutable
 * PickupRecord, updates the trip-student roster row, refreshes the trip's
 * boarded count, and rolls it into the TransportAttendance record for the
 * day. All four stay in sync from this single call so nothing drifts. */
export function markStudentPickup(tripId: string, studentId: string, status: PickupStatus, actor: Actor, verificationMethod?: VerificationMethod, reason?: string): Result {
  const db = getSnapshot();
  const trip = db.transportTrips.find((t) => t.id === tripId);
  if (!trip) return { ok: false, error: "Trip not found." };
  const tripStudent = db.tripStudents.find((ts) => ts.tripId === tripId && ts.studentId === studentId);
  if (!tripStudent) return { ok: false, error: "Student is not on this trip's roster." };

  const now = new Date().toISOString();
  setState((current) => {
    const tripStudents = current.tripStudents.map((ts) => (ts.id === tripStudent.id ? { ...ts, pickupStatus: status } : ts));
    const studentsBoarded = tripStudents.filter((ts) => ts.tripId === tripId && boardedPickupStatuses.has(ts.pickupStatus)).length;
    const existingAttendance = current.transportAttendance.find((a) => a.tripId === tripId && a.studentId === studentId);
    return {
      ...current,
      tripStudents,
      transportTrips: current.transportTrips.map((t) => (t.id === tripId ? { ...t, studentsBoarded, updatedAt: now } : t)),
      pickupRecords: [...current.pickupRecords, { id: generateId("pickup"), tripId, studentId, stopId: tripStudent.stopId, status, verificationMethod, recordedBy: actor.name, recordedAt: now, reason }],
      transportAttendance: existingAttendance
        ? current.transportAttendance.map((a) => (a.id === existingAttendance.id ? { ...a, pickupStatus: status } : a))
        : [...current.transportAttendance, { id: generateId("tatt"), tripId, studentId, routeId: trip.routeId, date: trip.date, pickupStatus: status, dropStatus: tripStudent.dropStatus }],
    };
  });

  logTransportAudit({ subjectId: studentId, action: "pickup-marked", actorName: actor.name, actorRole: actor.role, summary: `${studentLabel(db, studentId)} pickup marked "${status}" on trip ${trip.tripNumber}.`, reason, tripId });
  return { ok: true };
}

export function markStudentDrop(tripId: string, studentId: string, status: DropStatus, actor: Actor, verificationMethod?: VerificationMethod, guardianName?: string, reason?: string): Result {
  const db = getSnapshot();
  const trip = db.transportTrips.find((t) => t.id === tripId);
  if (!trip) return { ok: false, error: "Trip not found." };
  const tripStudent = db.tripStudents.find((ts) => ts.tripId === tripId && ts.studentId === studentId);
  if (!tripStudent) return { ok: false, error: "Student is not on this trip's roster." };

  const now = new Date().toISOString();
  setState((current) => {
    const tripStudents = current.tripStudents.map((ts) => (ts.id === tripStudent.id ? { ...ts, dropStatus: status } : ts));
    const studentsDropped = tripStudents.filter((ts) => ts.tripId === tripId && droppedStatuses.has(ts.dropStatus)).length;
    const existingAttendance = current.transportAttendance.find((a) => a.tripId === tripId && a.studentId === studentId);
    return {
      ...current,
      tripStudents,
      transportTrips: current.transportTrips.map((t) => (t.id === tripId ? { ...t, studentsDropped, updatedAt: now } : t)),
      dropRecords: [...current.dropRecords, { id: generateId("drop"), tripId, studentId, stopId: tripStudent.stopId, status, verificationMethod, guardianName, recordedBy: actor.name, recordedAt: now, reason }],
      transportAttendance: existingAttendance
        ? current.transportAttendance.map((a) => (a.id === existingAttendance.id ? { ...a, dropStatus: status } : a))
        : [...current.transportAttendance, { id: generateId("tatt"), tripId, studentId, routeId: trip.routeId, date: trip.date, pickupStatus: tripStudent.pickupStatus, dropStatus: status }],
    };
  });

  logTransportAudit({ subjectId: studentId, action: "drop-marked", actorName: actor.name, actorRole: actor.role, summary: `${studentLabel(db, studentId)} drop marked "${status}" on trip ${trip.tripNumber}.`, reason, tripId });
  return { ok: true };
}
