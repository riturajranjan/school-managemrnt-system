import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { markStudentDrop, markStudentPickup } from "./pickup-drop-service";
import { createTripForRoute } from "./trip-service";

const ACTOR = { name: "Attendant", role: "Attendant" };

function createTripWithStudent() {
  const db = getSnapshot();
  const route = db.transportRoutes.find((r) => r.status === "active" && r.assignedVehicleId && r.primaryDriverId && db.studentTransportAssignments.some((a) => a.routeId === r.id && a.status === "active"))!;
  const created = createTripForRoute(route.id, "2026-09-05", ACTOR);
  if (!created.ok || !created.trip) throw new Error("setup failed");
  const student = getSnapshot().tripStudents.find((ts) => ts.tripId === created.trip!.id)!;
  return { tripId: created.trip.id, studentId: student.studentId };
}

describe("markStudentPickup", () => {
  beforeEach(() => resetDemoData());

  it("marks a student boarded, writes a pickup record, and increments studentsBoarded", () => {
    const { tripId, studentId } = createTripWithStudent();
    const before = getSnapshot().transportTrips.find((t) => t.id === tripId)!.studentsBoarded;
    const result = markStudentPickup(tripId, studentId, "boarded", ACTOR, "attendant-confirmation");
    expect(result.ok).toBe(true);
    const after = getSnapshot();
    expect(after.transportTrips.find((t) => t.id === tripId)?.studentsBoarded).toBe(before + 1);
    expect(after.pickupRecords.some((p) => p.tripId === tripId && p.studentId === studentId && p.status === "boarded")).toBe(true);
    expect(after.tripStudents.find((ts) => ts.tripId === tripId && ts.studentId === studentId)?.pickupStatus).toBe("boarded");
  });

  it("creates a transport attendance rollup row on first mark, then updates it in place on subsequent marks", () => {
    const { tripId, studentId } = createTripWithStudent();
    markStudentPickup(tripId, studentId, "boarded", ACTOR);
    const afterFirst = getSnapshot().transportAttendance.filter((a) => a.tripId === tripId && a.studentId === studentId);
    expect(afterFirst).toHaveLength(1);

    markStudentPickup(tripId, studentId, "missed", ACTOR, undefined, "Correction");
    const afterSecond = getSnapshot().transportAttendance.filter((a) => a.tripId === tripId && a.studentId === studentId);
    expect(afterSecond).toHaveLength(1);
    expect(afterSecond[0].pickupStatus).toBe("missed");
  });

  it("does not count a missed pickup toward studentsBoarded", () => {
    const { tripId, studentId } = createTripWithStudent();
    const before = getSnapshot().transportTrips.find((t) => t.id === tripId)!.studentsBoarded;
    markStudentPickup(tripId, studentId, "missed", ACTOR, undefined, "Not at stop");
    const after = getSnapshot().transportTrips.find((t) => t.id === tripId)!.studentsBoarded;
    expect(after).toBe(before);
  });

  it("refuses to mark pickup for a student not on the trip roster", () => {
    const { tripId } = createTripWithStudent();
    const result = markStudentPickup(tripId, "no-such-student", "boarded", ACTOR);
    expect(result.ok).toBe(false);
  });
});

describe("markStudentDrop", () => {
  beforeEach(() => resetDemoData());

  it("marks a student dropped, writes a drop record, and increments studentsDropped", () => {
    const { tripId, studentId } = createTripWithStudent();
    markStudentPickup(tripId, studentId, "boarded", ACTOR);
    const before = getSnapshot().transportTrips.find((t) => t.id === tripId)!.studentsDropped;
    const result = markStudentDrop(tripId, studentId, "dropped", ACTOR, "attendant-confirmation", "Parent");
    expect(result.ok).toBe(true);
    const after = getSnapshot();
    expect(after.transportTrips.find((t) => t.id === tripId)?.studentsDropped).toBe(before + 1);
    expect(after.dropRecords.some((d) => d.tripId === tripId && d.studentId === studentId && d.status === "dropped")).toBe(true);
  });

  it("refuses to mark drop for a student not on the trip roster", () => {
    const { tripId } = createTripWithStudent();
    const result = markStudentDrop(tripId, "no-such-student", "dropped", ACTOR);
    expect(result.ok).toBe(false);
  });
});
