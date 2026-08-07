import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { CURRENT_SESSION } from "@/lib/data/seed/reference";
import { createRoute, setRouteStatus, addStopToRoute } from "./route-service";
import { assignStudentTransport, bulkAssignStudentsToRoute, reactivateStudentTransport, suspendStudentTransport, updateStudentAssignment, withdrawStudentTransport, type StudentAssignmentDraft } from "./student-transport-service";

const ACTOR = { name: "Transport Administrator", role: "Transport Administrator" };

function draftFor(studentId: string, routeId: string): StudentAssignmentDraft {
  const db = getSnapshot();
  const routeStop = db.routeStops.find((rs) => rs.routeId === routeId)!;
  const route = db.transportRoutes.find((r) => r.id === routeId)!;
  return { studentId, session: CURRENT_SESSION, routeId, pickupStopId: routeStop.stopId, dropStopId: routeStop.stopId, shift: route.shift, vehicleId: route.assignedVehicleId, effectiveFrom: "2026-04-01" };
}

function firstUnassignedStudent() {
  const db = getSnapshot();
  const assigned = new Set(db.studentTransportAssignments.filter((a) => a.status === "active").map((a) => a.studentId));
  return db.students.find((s) => s.status === "active" && !assigned.has(s.id));
}

describe("assignStudentTransport", () => {
  beforeEach(() => resetDemoData());

  it("assigns a student and syncs their denormalized transport summary", () => {
    const db = getSnapshot();
    const route = db.transportRoutes.find((r) => r.status === "active")!;
    const student = firstUnassignedStudent();
    if (!student) return;
    const result = assignStudentTransport(draftFor(student.id, route.id), ACTOR);
    expect(result.ok).toBe(true);
    if (!result.ok || !result.assignment) return;
    const after = getSnapshot();
    expect(after.studentTransportAssignments.some((a) => a.id === result.assignment!.id)).toBe(true);
    const updatedStudent = after.students.find((s) => s.id === student.id);
    expect(updatedStudent?.transport?.routeId).toBe(route.id);
  });

  it("refuses a duplicate active assignment for the same student and session", () => {
    const db = getSnapshot();
    const route = db.transportRoutes.find((r) => r.status === "active")!;
    const student = firstUnassignedStudent();
    if (!student) return;
    assignStudentTransport(draftFor(student.id, route.id), ACTOR);
    const second = assignStudentTransport(draftFor(student.id, route.id), ACTOR);
    expect(second.ok).toBe(false);
  });

  it("refuses a pickup stop that isn't on the route", () => {
    const db = getSnapshot();
    const route = db.transportRoutes.find((r) => r.status === "active")!;
    const student = firstUnassignedStudent();
    if (!student) return;
    const offRouteStop = db.transportStops.find((s) => !db.routeStops.some((rs) => rs.routeId === route.id && rs.stopId === s.id))!;
    const result = assignStudentTransport({ ...draftFor(student.id, route.id), pickupStopId: offRouteStop.id }, ACTOR);
    expect(result.ok).toBe(false);
  });

  it("refuses to overbook a route beyond its max capacity", () => {
    const db = getSnapshot();
    const stop = db.transportStops[0];
    const created = createRoute({ name: "Tiny Capacity Route", branch: "main", shift: "morning", direction: "both", type: "morning-pickup", startPoint: "Test", endPoint: "Novyra Public School", distanceKm: 5, estimatedDurationMinutes: 15, vehicleType: "van", maxCapacity: 2, effectiveFrom: "2026-04-01", status: "draft" }, ACTOR);
    if (!created.ok || !created.route) return;
    addStopToRoute(created.route.id, { stopId: stop.id, sequence: 1, pickupTime: "07:00", waitingMinutes: 3 }, ACTOR);
    expect(setRouteStatus(created.route.id, "active", ACTOR).ok).toBe(true);

    const eligibleStudents = db.students.filter((s) => s.status === "active" && !db.studentTransportAssignments.some((a) => a.studentId === s.id && a.status === "active")).slice(0, 3);
    if (eligibleStudents.length < 3) return;

    const routeId = created.route.id;
    const first = assignStudentTransport({ studentId: eligibleStudents[0].id, session: CURRENT_SESSION, routeId, pickupStopId: stop.id, dropStopId: stop.id, shift: "morning", effectiveFrom: "2026-04-01" }, ACTOR);
    const second = assignStudentTransport({ studentId: eligibleStudents[1].id, session: CURRENT_SESSION, routeId, pickupStopId: stop.id, dropStopId: stop.id, shift: "morning", effectiveFrom: "2026-04-01" }, ACTOR);
    const third = assignStudentTransport({ studentId: eligibleStudents[2].id, session: CURRENT_SESSION, routeId, pickupStopId: stop.id, dropStopId: stop.id, shift: "morning", effectiveFrom: "2026-04-01" }, ACTOR);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(third.ok).toBe(false);
  });
});

describe("updateStudentAssignment / withdraw / suspend / reactivate", () => {
  beforeEach(() => resetDemoData());

  it("withdraws an assignment and clears the student's transport summary", () => {
    const db = getSnapshot();
    const route = db.transportRoutes.find((r) => r.status === "active")!;
    const student = firstUnassignedStudent();
    if (!student) return;
    const created = assignStudentTransport(draftFor(student.id, route.id), ACTOR);
    if (!created.ok || !created.assignment) return;
    const result = withdrawStudentTransport(created.assignment.id, "Family relocated", ACTOR);
    expect(result.ok).toBe(true);
    const after = getSnapshot();
    expect(after.studentTransportAssignments.find((a) => a.id === created.assignment!.id)?.status).toBe("withdrawn");
    expect(after.students.find((s) => s.id === student.id)?.transport).toBeUndefined();
  });

  it("suspends then reactivates an assignment", () => {
    const db = getSnapshot();
    const route = db.transportRoutes.find((r) => r.status === "active")!;
    const student = firstUnassignedStudent();
    if (!student) return;
    const created = assignStudentTransport(draftFor(student.id, route.id), ACTOR);
    if (!created.ok || !created.assignment) return;
    expect(suspendStudentTransport(created.assignment.id, "Temporary pause", ACTOR).ok).toBe(true);
    expect(getSnapshot().studentTransportAssignments.find((a) => a.id === created.assignment!.id)?.status).toBe("suspended");
    expect(reactivateStudentTransport(created.assignment.id, ACTOR).ok).toBe(true);
    expect(getSnapshot().studentTransportAssignments.find((a) => a.id === created.assignment!.id)?.status).toBe("active");
  });

  it("updates an assignment's special instructions", () => {
    const db = getSnapshot();
    const route = db.transportRoutes.find((r) => r.status === "active")!;
    const student = firstUnassignedStudent();
    if (!student) return;
    const created = assignStudentTransport(draftFor(student.id, route.id), ACTOR);
    if (!created.ok || !created.assignment) return;
    const result = updateStudentAssignment(created.assignment.id, { specialInstructions: "Allergic to peanuts" }, ACTOR);
    expect(result.ok).toBe(true);
    expect(getSnapshot().studentTransportAssignments.find((a) => a.id === created.assignment!.id)?.specialInstructions).toBe("Allergic to peanuts");
  });
});

describe("bulkAssignStudentsToRoute", () => {
  beforeEach(() => resetDemoData());

  it("assigns valid students and skips those that would violate a rule, without throwing", () => {
    const db = getSnapshot();
    const route = db.transportRoutes.find((r) => r.status === "active")!;
    const alreadyAssignedStudent = db.studentTransportAssignments.find((a) => a.routeId !== route.id && a.status === "active");
    const freshStudent = firstUnassignedStudent();
    const routeStop = db.routeStops.find((rs) => rs.routeId === route.id)!;
    const candidateIds = [freshStudent?.id, alreadyAssignedStudent?.studentId].filter((id): id is string => !!id);
    if (candidateIds.length === 0) return;

    const result = bulkAssignStudentsToRoute(candidateIds, route.id, routeStop.stopId, routeStop.stopId, CURRENT_SESSION, ACTOR);
    expect(result.assigned.length + result.skipped.length).toBe(candidateIds.length);
  });
});
