import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { assignStudentToSeat, blockSeat, clearSeat, moveStudentSeat, reserveSeat } from "./seat-service";

const ACTOR = { name: "Transport Administrator", role: "Transport Administrator" };

function emptyStandardSeat() {
  const db = getSnapshot();
  return db.vehicleSeats.find((s) => s.type === "standard" && !s.studentId)!;
}

describe("reserveSeat / blockSeat / clearSeat", () => {
  beforeEach(() => resetDemoData());

  it("reserves an empty seat", () => {
    const seat = emptyStandardSeat();
    expect(reserveSeat(seat.id, ACTOR).ok).toBe(true);
    expect(getSnapshot().vehicleSeats.find((s) => s.id === seat.id)?.type).toBe("reserved");
  });

  it("refuses to reserve an already-occupied seat", () => {
    const db = getSnapshot();
    const occupied = db.vehicleSeats.find((s) => s.studentId);
    if (!occupied) return;
    expect(reserveSeat(occupied.id, ACTOR).ok).toBe(false);
  });

  it("blocks a seat with a reason", () => {
    const seat = emptyStandardSeat();
    expect(blockSeat(seat.id, ACTOR, "Broken seatbelt").ok).toBe(true);
    expect(getSnapshot().vehicleSeats.find((s) => s.id === seat.id)?.type).toBe("unavailable");
  });

  it("clears a blocked seat back to standard", () => {
    const seat = emptyStandardSeat();
    blockSeat(seat.id, ACTOR);
    expect(clearSeat(seat.id, ACTOR).ok).toBe(true);
    expect(getSnapshot().vehicleSeats.find((s) => s.id === seat.id)?.type).toBe("standard");
  });

  it("clearing an occupied seat also detaches it from the student's assignment", () => {
    const db = getSnapshot();
    const occupied = db.vehicleSeats.find((s) => s.studentId);
    if (!occupied) return;
    const assignment = db.studentTransportAssignments.find((a) => a.seatId === occupied.id);
    expect(clearSeat(occupied.id, ACTOR).ok).toBe(true);
    const after = getSnapshot();
    expect(after.vehicleSeats.find((s) => s.id === occupied.id)?.studentId).toBeUndefined();
    if (assignment) expect(after.studentTransportAssignments.find((a) => a.id === assignment.id)?.seatId).toBeUndefined();
  });
});

describe("moveStudentSeat", () => {
  beforeEach(() => resetDemoData());

  it("moves a seated student to an empty seat on the same vehicle", () => {
    const db = getSnapshot();
    const occupied = db.vehicleSeats.find((s) => s.studentId);
    if (!occupied) return;
    const target = db.vehicleSeats.find((s) => s.vehicleId === occupied.vehicleId && s.type === "standard" && !s.studentId && s.id !== occupied.id);
    if (!target) return;

    const studentId = occupied.studentId;
    const result = moveStudentSeat(occupied.id, target.id, ACTOR);
    expect(result.ok).toBe(true);
    const after = getSnapshot();
    expect(after.vehicleSeats.find((s) => s.id === occupied.id)?.studentId).toBeUndefined();
    expect(after.vehicleSeats.find((s) => s.id === target.id)?.studentId).toBe(studentId);
  });

  it("refuses to move into an already-occupied seat", () => {
    const db = getSnapshot();
    const occupiedSeats = db.vehicleSeats.filter((s) => s.studentId);
    if (occupiedSeats.length < 2) return;
    const result = moveStudentSeat(occupiedSeats[0].id, occupiedSeats[1].id, ACTOR);
    expect(result.ok).toBe(false);
  });
});

describe("assignStudentToSeat", () => {
  beforeEach(() => resetDemoData());

  it("refuses to assign into a blocked seat", () => {
    const seat = emptyStandardSeat();
    blockSeat(seat.id, ACTOR);
    const db = getSnapshot();
    const student = db.students[0];
    expect(assignStudentToSeat(seat.id, student.id, "route-1", ACTOR).ok).toBe(false);
  });

  it("assigns a student into an empty seat", () => {
    const seat = emptyStandardSeat();
    const db = getSnapshot();
    const unassignedStudent = db.students.find((s) => !db.studentTransportAssignments.some((a) => a.studentId === s.id && a.status === "active"));
    if (!unassignedStudent) return;
    const result = assignStudentToSeat(seat.id, unassignedStudent.id, "route-1", ACTOR);
    expect(result.ok).toBe(true);
    expect(getSnapshot().vehicleSeats.find((s) => s.id === seat.id)?.studentId).toBe(unassignedStudent.id);
  });
});
