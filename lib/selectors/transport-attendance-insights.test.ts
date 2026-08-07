import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { markStudentPickup } from "@/lib/services/pickup-drop-service";
import { createTripForRoute } from "@/lib/services/trip-service";
import { attendanceForDate, routeAttendanceSummary, stopAttendanceSummary } from "./transport-attendance-insights";

const ACTOR = { name: "Attendant", role: "Attendant" };

describe("routeAttendanceSummary / stopAttendanceSummary / attendanceForDate", () => {
  beforeEach(() => resetDemoData());

  it("counts a boarded pickup toward the route summary for the trip's date", () => {
    const db = getSnapshot();
    const route = db.transportRoutes.find((r) => r.status === "active" && r.assignedVehicleId && r.primaryDriverId && db.studentTransportAssignments.some((a) => a.routeId === r.id && a.status === "active"))!;
    const created = createTripForRoute(route.id, "2026-09-10", ACTOR);
    if (!created.ok || !created.trip) return;
    const tripStudent = getSnapshot().tripStudents.find((ts) => ts.tripId === created.trip!.id)!;
    markStudentPickup(created.trip.id, tripStudent.studentId, "boarded", ACTOR);

    const summary = routeAttendanceSummary(getSnapshot(), "2026-09-10").find((r) => r.routeId === route.id)!;
    expect(summary.boarded).toBeGreaterThanOrEqual(1);
    expect(summary.expected).toBeGreaterThanOrEqual(1);
  });

  it("groups attendance by stop", () => {
    const db = getSnapshot();
    const route = db.transportRoutes.find((r) => r.status === "active" && r.assignedVehicleId && r.primaryDriverId && db.studentTransportAssignments.some((a) => a.routeId === r.id && a.status === "active"))!;
    const created = createTripForRoute(route.id, "2026-09-11", ACTOR);
    if (!created.ok || !created.trip) return;
    const tripStudent = getSnapshot().tripStudents.find((ts) => ts.tripId === created.trip!.id)!;
    markStudentPickup(created.trip.id, tripStudent.studentId, "boarded", ACTOR);

    const summary = stopAttendanceSummary(getSnapshot(), "2026-09-11");
    expect(summary.some((s) => s.stopId === tripStudent.stopId)).toBe(true);
  });

  it("returns only attendance rows for the requested date", () => {
    const db = getSnapshot();
    const route = db.transportRoutes.find((r) => r.status === "active" && r.assignedVehicleId && r.primaryDriverId)!;
    const created = createTripForRoute(route.id, "2026-09-12", ACTOR);
    if (!created.ok || !created.trip) return;
    const tripStudent = getSnapshot().tripStudents.find((ts) => ts.tripId === created.trip!.id);
    if (tripStudent) markStudentPickup(created.trip.id, tripStudent.studentId, "boarded", ACTOR);

    expect(attendanceForDate(getSnapshot(), "2026-09-12").every((a) => a.date === "2026-09-12")).toBe(true);
    expect(attendanceForDate(getSnapshot(), "1999-01-01")).toHaveLength(0);
  });
});
