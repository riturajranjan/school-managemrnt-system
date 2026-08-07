import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { assignStaffTransport, setStaffAssignmentStatus } from "./staff-transport-service";

const ACTOR = { name: "Transport Administrator", role: "Transport Administrator" };

function unassignedTeacher(excludeIds: string[] = []) {
  const db = getSnapshot();
  const assigned = new Set(db.staffTransportAssignments.filter((a) => a.status === "active").map((a) => a.staffId));
  return db.teachers.find((t) => !assigned.has(t.id) && !excludeIds.includes(t.id))!;
}

describe("assignStaffTransport / setStaffAssignmentStatus", () => {
  beforeEach(() => resetDemoData());

  it("assigns a staff member to a route", () => {
    const db = getSnapshot();
    const route = db.transportRoutes.find((r) => r.status === "active")!;
    const routeStop = db.routeStops.find((rs) => rs.routeId === route.id)!;
    const teacher = unassignedTeacher();
    const result = assignStaffTransport({ staffName: teacher.name, staffId: teacher.id, routeId: route.id, pickupStopId: routeStop.stopId, shift: route.shift, effectiveFrom: "2026-04-01" }, ACTOR);
    expect(result.ok).toBe(true);
    expect(getSnapshot().staffTransportAssignments.some((a) => a.staffId === teacher.id)).toBe(true);
  });

  it("refuses a second active assignment for the same staff member", () => {
    const db = getSnapshot();
    const route = db.transportRoutes.find((r) => r.status === "active")!;
    const routeStop = db.routeStops.find((rs) => rs.routeId === route.id)!;
    const teacher = unassignedTeacher();
    assignStaffTransport({ staffName: teacher.name, staffId: teacher.id, routeId: route.id, pickupStopId: routeStop.stopId, shift: route.shift, effectiveFrom: "2026-04-01" }, ACTOR);
    const second = assignStaffTransport({ staffName: teacher.name, staffId: teacher.id, routeId: route.id, pickupStopId: routeStop.stopId, shift: route.shift, effectiveFrom: "2026-04-01" }, ACTOR);
    expect(second.ok).toBe(false);
  });

  it("withdraws a staff assignment", () => {
    const db = getSnapshot();
    const route = db.transportRoutes.find((r) => r.status === "active")!;
    const routeStop = db.routeStops.find((rs) => rs.routeId === route.id)!;
    const teacher = unassignedTeacher();
    const created = assignStaffTransport({ staffName: teacher.name, staffId: teacher.id, routeId: route.id, pickupStopId: routeStop.stopId, shift: route.shift, effectiveFrom: "2026-04-01" }, ACTOR);
    if (!created.ok || !created.assignment) return;
    const result = setStaffAssignmentStatus(created.assignment.id, "withdrawn", ACTOR, "No longer required");
    expect(result.ok).toBe(true);
    expect(getSnapshot().staffTransportAssignments.find((a) => a.id === created.assignment!.id)?.status).toBe("withdrawn");
  });
});
