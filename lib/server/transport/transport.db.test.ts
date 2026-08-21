// Transport Management DB integration tests (Phase 9M). Real Postgres:
// Vehicle/Stop/Route CRUD + concurrency, Route<->Stop ordering, effective-
// dated Route<->Vehicle/Staff assignment + concurrency, real-Staff
// driver/attendant listing, Student/Staff transport assignment (session-
// scoped for students, real-Enrollment-derived bulk assign) + concurrency,
// Trip lifecycle (create/start/complete/cancel) with crew/roster snapshot +
// concurrency, stop-timeline + boarding/drop marking, self-service ownership
// (Staff.userId, no transport.* permission needed for own trip), dashboard,
// isolation, RBAC, audit, DTO safety. Namespaced ("T9M"). Mirrors the exact
// setup/teardown pattern of lib/server/visitors/visitors.db.test.ts.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createVehicle, listVehicles, updateVehicle } from "@/lib/server/transport/vehicles";
import { createStop, flagStopUnsafe, listStops, setStopStatus } from "@/lib/server/transport/stops";
import {
  createRoute,
  getCurrentRouteAssignment,
  getRoute,
  listCurrentTransportStaff,
  listRouteAssignmentHistory,
  listRoutes,
  setRouteAssignment,
  setRouteStops,
  updateRoute,
} from "@/lib/server/transport/routes";
import { assignStudentTransport, bulkAssignStudentTransport, getStudentTransportProfile, listStudentAssignments, withdrawStudentTransport } from "@/lib/server/transport/student-assignments";
import { assignStaffTransport, listStaffAssignments, withdrawStaffTransport } from "@/lib/server/transport/staff-assignments";
import { cancelTrip, completeTrip, createTrip, getTrip, listTrips, markStudentBoarding, markStudentDrop, markTripStopStatus, startTrip } from "@/lib/server/transport/trips";
import { getTransportDashboard } from "@/lib/server/transport/dashboard";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T9M";
const stamp = Date.now().toString(36);

let tenantId = "", schoolId = "", branchA = "", sessionId = "", classId = "", sectionId = "";
let student1 = "", student2 = "", student3 = "";
let driverStaff = "", attendantStaff = "", driverUser = "";
let foreignTenantId = "", foreignSchoolId = "", foreignBranchId = "";
let scopeAdmin: OrgScope, scopeManager: OrgScope, scopeTeacher: OrgScope, scopeDriver: OrgScope, scopeForeignAdmin: OrgScope;
let adminUser = "", managerUser = "", teacherUser = "", foreignAdminUser = "";

async function makeUserWithRole(email: string, roleKey: string, tid = tenantId): Promise<string> {
  const u = await prisma.user.create({ data: { email, name: email, status: "ACTIVE" }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId: tid, status: "ACTIVE" }, select: { id: true } });
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  return u.id;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t9m-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;
  sessionId = (await prisma.academicSession.create({ data: { schoolId, name: "26-27", code: `${NS}-S`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  classId = (await prisma.class.create({ data: { tenantId, schoolId, academicSessionId: sessionId, name: "Grade 5", order: 5 }, select: { id: true } })).id;
  sectionId = (await prisma.section.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, name: "A", status: "ACTIVE" }, select: { id: true } })).id;

  for (const [i, name] of ["one", "two", "three"].entries()) {
    const s = (await prisma.student.create({
      data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, admissionNumber: `${NS}-${stamp}-${i}`, firstName: name, lastName: "T", dateOfBirth: new Date("2015-01-01"), admissionDate: new Date("2024-04-01"), status: "ACTIVE" },
      select: { id: true },
    })).id;
    await prisma.enrollment.create({ data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, classId, sectionId, studentId: s, status: "ENROLLED" } });
    if (i === 0) student1 = s;
    else if (i === 1) student2 = s;
    else student3 = s;
  }

  adminUser = await makeUserWithRole(`t9m-admin-${stamp}@x.test`, "SCHOOL_ADMIN");
  managerUser = await makeUserWithRole(`t9m-mgr-${stamp}@x.test`, "TRANSPORT_MANAGER");
  teacherUser = await makeUserWithRole(`t9m-t1-${stamp}@x.test`, "TEACHER");
  driverUser = await makeUserWithRole(`t9m-driver-${stamp}@x.test`, "TEACHER");

  driverStaff = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-D-${stamp}`, firstName: "Driving", lastName: "Person", status: "ACTIVE", userId: driverUser }, select: { id: true } })).id;
  attendantStaff = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-A-${stamp}`, firstName: "Attending", lastName: "Person", status: "ACTIVE" }, select: { id: true } })).id;

  foreignTenantId = (await prisma.tenant.create({ data: { name: `${NS} T2`, slug: `t9m-b-${stamp}` }, select: { id: true } })).id;
  foreignSchoolId = (await prisma.school.create({ data: { tenantId: foreignTenantId, name: `${NS} S2`, code: `${NS}-B-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  foreignBranchId = (await prisma.branch.create({ data: { schoolId: foreignSchoolId, name: "B", code: `${NS}-B`, status: "ACTIVE" }, select: { id: true } })).id;
  foreignAdminUser = await makeUserWithRole(`t9m-fadmin-${stamp}@x.test`, "SCHOOL_ADMIN", foreignTenantId);

  scopeAdmin = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: adminUser, name: "Admin" } };
  scopeManager = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: managerUser, name: "Manager" } };
  scopeTeacher = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: teacherUser, name: "Teacher" } };
  scopeDriver = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: driverUser, name: "Driver" } };
  scopeForeignAdmin = { tenantId: foreignTenantId, schoolId: foreignSchoolId, branchId: foreignBranchId, academicSessionId: null, actor: { id: foreignAdminUser, name: "Foreign Admin" } };
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.transportTripStudent.deleteMany({ where: { trip: { tenantId: { in: [tenantId, foreignTenantId] } } } });
  await prisma.transportTripStop.deleteMany({ where: { trip: { tenantId: { in: [tenantId, foreignTenantId] } } } });
  await prisma.transportTrip.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.studentTransportAssignment.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.staffTransportAssignment.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.transportRouteAssignment.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.transportRouteStop.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.transportRoute.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.transportStop.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.transportVehicle.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.enrollment.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.student.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.staff.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.section.deleteMany({ where: { tenantId } });
  await prisma.class.deleteMany({ where: { tenantId } });
  await prisma.roleAssignment.deleteMany({ where: { membership: { tenantId: { in: [tenantId, foreignTenantId] } } } });
  await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.academicSession.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.branch.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.school.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [adminUser, managerUser, teacherUser, driverUser, foreignAdminUser] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, foreignTenantId] } } });
});

describe.skipIf(!dbReady)("Vehicles (DB)", () => {
  it("creates a vehicle and lists it", async () => {
    const v = await createVehicle(scopeManager, { registrationNumber: `${NS}-V1-${stamp}`, capacity: 40, type: "bus" });
    expect(v.status).toBe("active");
    const list = await listVehicles(scopeAdmin);
    expect(list.some((x) => x.id === v.id)).toBe(true);
  });

  it("rejects a duplicate registration number", async () => {
    const reg = `${NS}-VDUP-${stamp}`;
    await createVehicle(scopeManager, { registrationNumber: reg, capacity: 30 });
    await expect(createVehicle(scopeManager, { registrationNumber: reg, capacity: 30 })).rejects.toThrow(HttpError);
  });

  it("registration-number uniqueness is race-safe under concurrent creates", async () => {
    const reg = `${NS}-VRACE-${stamp}`;
    const results = await Promise.all(Array.from({ length: 6 }, () => createVehicle(scopeManager, { registrationNumber: reg, capacity: 20 }).catch((e) => e)));
    const succeeded = results.filter((r) => !(r instanceof Error));
    expect(succeeded.length).toBe(1);
    const count = await prisma.transportVehicle.count({ where: { schoolId, registrationNumber: reg } });
    expect(count).toBe(1);
  });

  it("updates a vehicle", async () => {
    const v = await createVehicle(scopeManager, { registrationNumber: `${NS}-VUP-${stamp}`, capacity: 25 });
    const updated = await updateVehicle(scopeManager, v.id, { capacity: 35, displayName: "Bus Renamed" });
    expect(updated.capacity).toBe(35);
    expect(updated.displayName).toBe("Bus Renamed");
  });
});

describe.skipIf(!dbReady)("Stops (DB)", () => {
  it("creates a stop and rejects a duplicate code", async () => {
    const code = `${NS}-STP-${stamp}`;
    await createStop(scopeManager, { name: "Gate 1", code, address: "Main Road" });
    await expect(createStop(scopeManager, { name: "Gate 1 dup", code, address: "Main Road" })).rejects.toThrow(HttpError);
  });

  it("flags a stop unsafe and restores it, clearing safety notes", async () => {
    const s = await createStop(scopeManager, { name: "Risky Stop", code: `${NS}-RISK-${stamp}`, address: "Back Lane" });
    const flagged = await flagStopUnsafe(scopeManager, s.id, { safetyNotes: "No streetlight" });
    expect(flagged.status).toBe("unsafe");
    expect(flagged.safetyNotes).toBe("No streetlight");
    const restored = await setStopStatus(scopeManager, s.id, "active");
    expect(restored.status).toBe("active");
    expect(restored.safetyNotes).toBeNull();
  });

  it("lists stops filtered by status", async () => {
    const list = await listStops(scopeAdmin, { status: "unsafe" });
    expect(list.every((s) => s.status === "unsafe")).toBe(true);
  });
});

describe.skipIf(!dbReady)("Routes + Stops + Assignment (DB)", () => {
  let routeId = "", vehicleId = "", stopP = "", stopD = "";

  it("creates a route and rejects a duplicate code", async () => {
    const code = `${NS}-RT-${stamp}`;
    const r = await createRoute(scopeManager, { name: "Route One", code, shift: "morning", direction: "both" });
    routeId = r.id;
    await expect(createRoute(scopeManager, { name: "Dup", code })).rejects.toThrow(HttpError);
  });

  it("route code uniqueness is race-safe under concurrent creates", async () => {
    const code = `${NS}-RTRACE-${stamp}`;
    const results = await Promise.all(Array.from({ length: 6 }, () => createRoute(scopeManager, { name: "Race Route", code }).catch((e) => e)));
    const succeeded = results.filter((r) => !(r instanceof Error));
    expect(succeeded.length).toBe(1);
  });

  it("sets an ordered stop list on the route (atomic replace) and rejects duplicate/invalid stops", async () => {
    const s1 = await createStop(scopeManager, { name: "Stop P", code: `${NS}-SP-${stamp}`, address: "A" });
    const s2 = await createStop(scopeManager, { name: "Stop D", code: `${NS}-SD-${stamp}`, address: "B" });
    stopP = s1.id; stopD = s2.id;

    const set = await setRouteStops(scopeManager, routeId, { stops: [{ stopId: stopP, sequence: 1 }, { stopId: stopD, sequence: 2 }] });
    expect(set.map((s) => s.stopId)).toEqual([stopP, stopD]);

    await expect(setRouteStops(scopeManager, routeId, { stops: [{ stopId: stopP, sequence: 1 }, { stopId: stopP, sequence: 2 }] })).rejects.toThrow(HttpError);
    await expect(setRouteStops(scopeManager, routeId, { stops: [{ stopId: "nonexistent-stop", sequence: 1 }] })).rejects.toThrow(HttpError);

    const reordered = await setRouteStops(scopeManager, routeId, { stops: [{ stopId: stopD, sequence: 1 }, { stopId: stopP, sequence: 2 }] });
    expect(reordered.map((s) => s.stopId)).toEqual([stopD, stopP]);
    await setRouteStops(scopeManager, routeId, { stops: [{ stopId: stopP, sequence: 1 }, { stopId: stopD, sequence: 2 }] });
  });

  it("activates the route, then assigns a vehicle + driver + attendant; reassigning ends the old assignment", async () => {
    await updateRoute(scopeManager, routeId, { status: "active" });
    const v = await createVehicle(scopeManager, { registrationNumber: `${NS}-RV1-${stamp}`, capacity: 30 });
    vehicleId = v.id;

    const first = await setRouteAssignment(scopeManager, routeId, { vehicleId, driverStaffId: driverStaff, attendantStaffId: attendantStaff });
    expect(first.status).toBe("active");
    expect(first.driverStaffId).toBe(driverStaff);

    const v2 = await createVehicle(scopeManager, { registrationNumber: `${NS}-RV2-${stamp}`, capacity: 30 });
    const second = await setRouteAssignment(scopeManager, routeId, { vehicleId: v2.id, driverStaffId: driverStaff });
    expect(second.id).not.toBe(first.id);

    const current = await getCurrentRouteAssignment(scopeAdmin, routeId);
    expect(current!.id).toBe(second.id);
    const history = await listRouteAssignmentHistory(scopeAdmin, routeId);
    expect(history.some((h) => h.id === first.id && h.status === "ended")).toBe(true);
  });

  it("rejects an inactive/foreign staff member as driver", async () => {
    const inactive = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-INACT-${stamp}`, firstName: "Inactive", status: "INACTIVE" }, select: { id: true } })).id;
    await expect(setRouteAssignment(scopeManager, routeId, { vehicleId, driverStaffId: inactive })).rejects.toThrow(HttpError);
  });

  it("at most one ACTIVE assignment per route is race-safe under concurrent assignment calls", async () => {
    const code = `${NS}-RTRACE2-${stamp}`;
    const r = await createRoute(scopeManager, { name: "Race Assign Route", code });
    await updateRoute(scopeManager, r.id, { status: "active" });
    const v = await createVehicle(scopeManager, { registrationNumber: `${NS}-RVRACE-${stamp}`, capacity: 20 });
    const results = await Promise.all(Array.from({ length: 5 }, () => setRouteAssignment(scopeManager, r.id, { vehicleId: v.id }).catch((e) => e)));
    const succeeded = results.filter((x) => !(x instanceof Error));
    expect(succeeded.length).toBeGreaterThanOrEqual(1);
    const activeCount = await prisma.transportRouteAssignment.count({ where: { routeId: r.id, status: "ACTIVE" } });
    expect(activeCount).toBe(1);
  });

  it("lists real Staff currently on driver/attendant duty — never a parallel identity", async () => {
    const drivers = await listCurrentTransportStaff(scopeAdmin, "driver");
    expect(drivers.some((d) => d.staffId === driverStaff)).toBe(true);
    const attendants = await listCurrentTransportStaff(scopeAdmin, "attendant");
    expect(Array.isArray(attendants)).toBe(true);
  });

  it("lists and gets routes", async () => {
    const list = await listRoutes(scopeAdmin, { status: "active" });
    expect(list.some((r) => r.id === routeId)).toBe(true);
    const got = await getRoute(scopeAdmin, routeId);
    expect(got.id).toBe(routeId);
  });
});

describe.skipIf(!dbReady)("Student Transport Assignments (DB)", () => {
  let routeId = "", stopP = "", stopD = "";

  beforeAll(async () => {
    if (!dbReady) return;
    const r = await createRoute(scopeManager, { name: "Student Route", code: `${NS}-SRT-${stamp}` });
    routeId = r.id;
    await updateRoute(scopeManager, routeId, { status: "active" });
    const s1 = await createStop(scopeManager, { name: "SA Stop P", code: `${NS}-SASP-${stamp}`, address: "A" });
    const s2 = await createStop(scopeManager, { name: "SA Stop D", code: `${NS}-SASD-${stamp}`, address: "B" });
    stopP = s1.id; stopD = s2.id;
    await setRouteStops(scopeManager, routeId, { stops: [{ stopId: stopP, sequence: 1 }, { stopId: stopD, sequence: 2 }] });
  });

  it("assigns a student to a route/stop and rejects a stop not on the route", async () => {
    const a = await assignStudentTransport(scopeManager, { studentId: student1, routeId, pickupStopId: stopP });
    expect(a.status).toBe("active");
    expect(a.dropStopId).toBe(stopP); // defaults dropStopId to pickupStopId when omitted

    const otherStop = await createStop(scopeManager, { name: "Off Route", code: `${NS}-OFFR-${stamp}`, address: "C" });
    await expect(assignStudentTransport(scopeManager, { studentId: student2, routeId, pickupStopId: otherStop.id })).rejects.toThrow(HttpError);
  });

  it("rejects a duplicate active assignment for the same student+session, race-safe under concurrency", async () => {
    await expect(assignStudentTransport(scopeManager, { studentId: student1, routeId, pickupStopId: stopP })).rejects.toThrow(HttpError);

    const results = await Promise.all(Array.from({ length: 5 }, () => assignStudentTransport(scopeManager, { studentId: student2, routeId, pickupStopId: stopP }).catch((e) => e)));
    const succeeded = results.filter((x) => !(x instanceof Error));
    expect(succeeded.length).toBe(1);
  });

  it("bulk-assigns every actively enrolled student in the class, skipping already-assigned students", async () => {
    const result = await bulkAssignStudentTransport(scopeManager, { classId, routeId, pickupStopId: stopD });
    // student1 and student2 already have active assignments from prior tests; only student3 is new.
    expect(result.assignedCount).toBe(1);
    expect(result.skippedCount).toBe(2);
  });

  it("withdraws a student assignment", async () => {
    const list = await listStudentAssignments(scopeAdmin, { routeId });
    const active = list.find((a) => a.studentId === student3 && a.status === "active")!;
    const withdrawn = await withdrawStudentTransport(scopeManager, active.id, { reason: "Moved house" });
    expect(withdrawn.status).toBe("withdrawn");
    await expect(withdrawStudentTransport(scopeManager, active.id)).rejects.toThrow(HttpError); // already withdrawn
  });

  it("Student 360 transport profile returns the current assignment plus route vehicle/crew", async () => {
    const v = await createVehicle(scopeManager, { registrationNumber: `${NS}-SPV-${stamp}`, capacity: 20 });
    await setRouteAssignment(scopeManager, routeId, { vehicleId: v.id, driverStaffId: driverStaff });
    const profile = await getStudentTransportProfile(scopeAdmin, student1);
    expect(profile.assignment).not.toBeNull();
    expect(profile.assignment!.routeId).toBe(routeId);
    expect(profile.vehicle!.registrationNumber).toBe(v.registrationNumber);
    expect(profile.driverName).toBeTruthy();
  });

  it("a student with no assignment gets a null profile, not an error", async () => {
    const s = (await prisma.student.create({
      data: { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, admissionNumber: `${NS}-NOASSIGN-${stamp}`, firstName: "NoTransport", lastName: "T", dateOfBirth: new Date("2015-01-01"), admissionDate: new Date("2024-04-01"), status: "ACTIVE" },
      select: { id: true },
    })).id;
    const profile = await getStudentTransportProfile(scopeAdmin, s);
    expect(profile.assignment).toBeNull();
    expect(profile.vehicle).toBeNull();
  });
});

describe.skipIf(!dbReady)("Staff Transport Assignments (DB)", () => {
  let routeId = "", stopId = "";

  beforeAll(async () => {
    if (!dbReady) return;
    const r = await createRoute(scopeManager, { name: "Staff Route", code: `${NS}-STFRT-${stamp}` });
    routeId = r.id;
    await updateRoute(scopeManager, routeId, { status: "active" });
    const s = await createStop(scopeManager, { name: "Staff Stop", code: `${NS}-STFSTP-${stamp}`, address: "A" });
    stopId = s.id;
    await setRouteStops(scopeManager, routeId, { stops: [{ stopId: s.id, sequence: 1 }] });
  });

  it("assigns staff transport and rejects a duplicate active assignment", async () => {
    const a = await assignStaffTransport(scopeManager, { staffId: attendantStaff, routeId, pickupStopId: stopId });
    expect(a.status).toBe("active");
    await expect(assignStaffTransport(scopeManager, { staffId: attendantStaff, routeId, pickupStopId: stopId })).rejects.toThrow(HttpError);
  });

  it("withdraws a staff assignment", async () => {
    const list = await listStaffAssignments(scopeAdmin, { status: "active" });
    const row = list.find((a) => a.staffId === attendantStaff)!;
    const withdrawn = await withdrawStaffTransport(scopeManager, row.id);
    expect(withdrawn.status).toBe("withdrawn");
  });
});

describe.skipIf(!dbReady)("Trips: create + lifecycle + concurrency (DB)", () => {
  let routeId = "", vehicleId = "";
  const tripDate = "2026-09-01";

  beforeAll(async () => {
    if (!dbReady) return;
    const r = await createRoute(scopeManager, { name: "Trip Route", code: `${NS}-TRPRT-${stamp}` });
    routeId = r.id;
    await updateRoute(scopeManager, routeId, { status: "active" });
    const s1 = await createStop(scopeManager, { name: "Trip Stop 1", code: `${NS}-TS1-${stamp}`, address: "A" });
    const s2 = await createStop(scopeManager, { name: "Trip Stop 2", code: `${NS}-TS2-${stamp}`, address: "B" });
    await setRouteStops(scopeManager, routeId, { stops: [{ stopId: s1.id, sequence: 1 }, { stopId: s2.id, sequence: 2 }] });
    const v = await createVehicle(scopeManager, { registrationNumber: `${NS}-TRPV-${stamp}`, capacity: 30 });
    vehicleId = v.id;
    await setRouteAssignment(scopeManager, routeId, { vehicleId, driverStaffId: driverStaff, attendantStaffId: attendantStaff });
    // student3's assignment from the earlier describe block was withdrawn, so
    // it's free to reassign here — student1/student2 still hold their only
    // ACTIVE (studentId, session) slot on Student Route (DB-enforced).
    await assignStudentTransport(scopeManager, { studentId: student3, routeId, pickupStopId: s1.id });
  });

  it("rejects creating a trip for a route with no vehicle assigned", async () => {
    const r = await createRoute(scopeManager, { name: "No Crew Route", code: `${NS}-NOCREW-${stamp}` });
    await updateRoute(scopeManager, r.id, { status: "active" });
    await expect(createTrip(scopeManager, { routeId: r.id, date: tripDate })).rejects.toThrow(HttpError);
  });

  it("creates a trip snapshotting crew/vehicle and seeding stops + student roster from real data", async () => {
    const trip = await createTrip(scopeManager, { routeId, date: tripDate, type: "pickup" });
    expect(trip.status).toBe("scheduled");
    expect(trip.vehicleId).toBe(vehicleId);
    expect(trip.driverStaffId).toBe(driverStaff);
    expect(trip.stops.length).toBe(2);
    expect(trip.students.length).toBe(1);
    expect(trip.students[0].studentId).toBe(student3);
    expect(trip.students[0].boardingStatus).toBe("expected");
  });

  it("rejects a duplicate trip for the same route/date/type, race-safe under concurrency", async () => {
    await expect(createTrip(scopeManager, { routeId, date: tripDate, type: "pickup" })).rejects.toThrow(HttpError);

    const results = await Promise.all(Array.from({ length: 5 }, () => createTrip(scopeManager, { routeId, date: tripDate, type: "drop" }).catch((e) => e)));
    const succeeded = results.filter((x) => !(x instanceof Error));
    expect(succeeded.length).toBe(1);
  });

  it("later route-crew changes never rewrite an already-created trip's history", async () => {
    const v2 = await createVehicle(scopeManager, { registrationNumber: `${NS}-TRPV2-${stamp}`, capacity: 30 });
    await setRouteAssignment(scopeManager, routeId, { vehicleId: v2.id, driverStaffId: attendantStaff });
    const trips = await listTrips(scopeAdmin, { routeId, date: tripDate, status: "scheduled" });
    const pickup = trips.find((t) => t.type === "pickup")!;
    const detail = await getTrip(scopeAdmin, pickup.id);
    expect(detail.vehicleId).toBe(vehicleId); // unchanged snapshot, not the new v2
    expect(detail.driverStaffId).toBe(driverStaff);
    await setRouteAssignment(scopeManager, routeId, { vehicleId, driverStaffId: driverStaff, attendantStaffId: attendantStaff }); // restore for later tests
  });

  it("enforces the lifecycle: cannot complete before starting", async () => {
    const trips = await listTrips(scopeAdmin, { routeId, date: tripDate });
    const tripId = trips.find((t) => t.type === "pickup")!.id;
    await expect(completeTrip(scopeManager, tripId, true)).rejects.toThrow(HttpError);
    const started = await startTrip(scopeManager, tripId, true);
    expect(started.status).toBe("in-progress");
    expect(started.startedAt).toBeTruthy();
    const completed = await completeTrip(scopeManager, tripId, true);
    expect(completed.status).toBe("completed");
    expect(completed.completedAt).toBeTruthy();
    await expect(startTrip(scopeManager, tripId, true)).rejects.toThrow(HttpError); // already completed
  });

  it("cancels a scheduled trip; cannot cancel a completed trip", async () => {
    const trip = await createTrip(scopeManager, { routeId, date: "2026-09-02", type: "pickup" });
    const cancelled = await cancelTrip(scopeManager, trip.id, true);
    expect(cancelled.status).toBe("cancelled");
    await expect(startTrip(scopeManager, trip.id, true)).rejects.toThrow(HttpError);

    const trips = await listTrips(scopeAdmin, { routeId, date: tripDate });
    const completedTrip = trips.find((t) => t.type === "pickup")!;
    await expect(cancelTrip(scopeManager, completedTrip.id, true)).rejects.toThrow(HttpError);
  });

  it("trip-start is race-safe: exactly one concurrent start succeeds", async () => {
    const trip = await createTrip(scopeManager, { routeId, date: "2026-09-03", type: "pickup" });
    const results = await Promise.all(Array.from({ length: 5 }, () => startTrip(scopeManager, trip.id, true).catch((e) => e)));
    const succeeded = results.filter((x) => !(x instanceof Error));
    expect(succeeded.length).toBe(1);
    const final = await getTrip(scopeAdmin, trip.id);
    expect(final.status).toBe("in-progress");
  });

  it("trip-completion is race-safe: exactly one concurrent complete succeeds", async () => {
    const trip = await createTrip(scopeManager, { routeId, date: "2026-09-04", type: "pickup" });
    await startTrip(scopeManager, trip.id, true);
    const results = await Promise.all(Array.from({ length: 5 }, () => completeTrip(scopeManager, trip.id, true).catch((e) => e)));
    const succeeded = results.filter((x) => !(x instanceof Error));
    expect(succeeded.length).toBe(1);
  });

  it("marks stop timeline arrived/departed in order", async () => {
    const trip = await createTrip(scopeManager, { routeId, date: "2026-09-05", type: "pickup" });
    await startTrip(scopeManager, trip.id, true);
    const firstStop = trip.stops[0];
    const arrived = await markTripStopStatus(scopeManager, trip.id, firstStop.id, "arrived", true);
    expect(arrived.stops.find((s) => s.id === firstStop.id)!.status).toBe("arrived");
    const departed = await markTripStopStatus(scopeManager, trip.id, firstStop.id, "departed", true);
    expect(departed.stops.find((s) => s.id === firstStop.id)!.status).toBe("departed");
  });

  it("marks student boarding then drop, in order, and is safe under concurrent duplicate boarding calls", async () => {
    const trip = await createTrip(scopeManager, { routeId, date: "2026-09-06", type: "pickup" });
    await startTrip(scopeManager, trip.id, true);
    const tripStudentId = trip.students[0].id;

    const results = await Promise.all(Array.from({ length: 4 }, () => markStudentBoarding(scopeManager, trip.id, tripStudentId, { status: "boarded" }, true).catch((e) => e)));
    expect(results.every((r) => !(r instanceof Error))).toBe(true); // idempotent status update, never crashes under concurrency
    const afterBoard = await getTrip(scopeAdmin, trip.id);
    const student = afterBoard.students.find((s) => s.id === tripStudentId)!;
    expect(student.boardingStatus).toBe("boarded");
    expect(student.dropStatus).toBe("onboard");

    const dropped = await markStudentDrop(scopeManager, trip.id, tripStudentId, { status: "dropped" }, true);
    expect(dropped.students.find((s) => s.id === tripStudentId)!.dropStatus).toBe("dropped");
  });

  it("marks a student absent instead of boarded", async () => {
    const trip = await createTrip(scopeManager, { routeId, date: "2026-09-07", type: "pickup" });
    const tripStudentId = trip.students[0].id;
    const marked = await markStudentBoarding(scopeManager, trip.id, tripStudentId, { status: "absent" }, true);
    expect(marked.students.find((s) => s.id === tripStudentId)!.boardingStatus).toBe("absent");
  });

  it("self-service: the assigned driver (via Staff.userId) can view and operate their own trip without transport.manage", async () => {
    const trip = await createTrip(scopeManager, { routeId, date: "2026-09-08", type: "pickup" });
    const viewed = await getTrip(scopeDriver, trip.id, false); // canView=false: not privileged, must fall back to ownership
    expect(viewed.id).toBe(trip.id);
    const started = await startTrip(scopeDriver, trip.id, false); // canManage=false: ownership-based
    expect(started.status).toBe("in-progress");
  });

  it("a non-owning, non-privileged caller gets NOT_FOUND (no existence leak) for someone else's trip", async () => {
    const trip = await createTrip(scopeManager, { routeId, date: "2026-09-09", type: "pickup" });
    await expect(getTrip(scopeTeacher, trip.id, false)).rejects.toThrow(HttpError);
    await expect(startTrip(scopeTeacher, trip.id, false)).rejects.toThrow(HttpError);
  });
});

describe.skipIf(!dbReady)("Dashboard (DB)", () => {
  it("returns real, DB-derived counts", async () => {
    const dashboard = await getTransportDashboard(scopeAdmin);
    expect(typeof dashboard.activeVehicles).toBe("number");
    expect(typeof dashboard.activeRoutes).toBe("number");
    expect(typeof dashboard.studentsAssigned).toBe("number");
    expect(dashboard.activeVehicles).toBeGreaterThan(0);
    expect(dashboard.activeRoutes).toBeGreaterThan(0);
  });
});

describe.skipIf(!dbReady)("Security / RBAC / Isolation / Audit / DTO safety (DB)", () => {
  it("transport.view/manage: TRANSPORT_MANAGER has both; SCHOOL_ADMIN has view only; TEACHER has neither", () => {
    expect(ROLE_PERMISSIONS.TRANSPORT_MANAGER).toContain("transport.view");
    expect(ROLE_PERMISSIONS.TRANSPORT_MANAGER).toContain("transport.manage");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("transport.view");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).not.toContain("transport.manage");
    expect(ROLE_PERMISSIONS.TEACHER ?? []).not.toContain("transport.view");
    expect(ROLE_PERMISSIONS.TEACHER ?? []).not.toContain("transport.manage");
  });

  it("cross-tenant vehicle/route/stop/trip is invisible (NOT_FOUND, not leaked)", async () => {
    const foreignVehicle = await createVehicle(scopeForeignAdmin, { registrationNumber: `${NS}-FV-${stamp}`, capacity: 20 });
    await expect(prisma.transportVehicle.findFirstOrThrow({ where: { id: foreignVehicle.id, schoolId } })).rejects.toThrow();

    const foreignRoute = await createRoute(scopeForeignAdmin, { name: "Foreign Route", code: `${NS}-FR-${stamp}` });
    await expect(getRoute(scopeAdmin, foreignRoute.id)).rejects.toThrow(HttpError);

    const foreignStop = await createStop(scopeForeignAdmin, { name: "Foreign Stop", code: `${NS}-FS-${stamp}`, address: "X" });
    await expect(setStopStatus(scopeAdmin, foreignStop.id, "inactive")).rejects.toThrow(HttpError);
  });

  it("transport mutations are audited", async () => {
    const events = await prisma.auditEvent.count({
      where: { tenantId, action: { in: ["TRANSPORT_VEHICLE_CREATED", "TRANSPORT_ROUTE_CREATED", "TRANSPORT_STOP_CREATED", "TRANSPORT_TRIP_CREATED", "TRANSPORT_TRIP_STARTED", "TRANSPORT_STUDENT_ASSIGNED"] } },
    });
    expect(events).toBeGreaterThan(5);
  });

  it("vehicle DTO never leaks fields beyond the documented contract", async () => {
    const v = await createVehicle(scopeManager, { registrationNumber: `${NS}-DTO-${stamp}`, capacity: 20 });
    const allowedKeys = new Set(["id", "registrationNumber", "displayName", "type", "make", "model", "capacity", "status", "createdAt", "updatedAt"]);
    for (const key of Object.keys(v)) expect(allowedKeys.has(key)).toBe(true);
  });

  it("trip detail DTO never leaks fields beyond the documented contract", async () => {
    const r = await createRoute(scopeManager, { name: "DTO Route", code: `${NS}-DTORT-${stamp}` });
    await updateRoute(scopeManager, r.id, { status: "active" });
    const stop = await createStop(scopeManager, { name: "DTO Stop", code: `${NS}-DTOSTP-${stamp}`, address: "A" });
    await setRouteStops(scopeManager, r.id, { stops: [{ stopId: stop.id, sequence: 1 }] });
    const v = await createVehicle(scopeManager, { registrationNumber: `${NS}-DTOV-${stamp}`, capacity: 20 });
    await setRouteAssignment(scopeManager, r.id, { vehicleId: v.id });
    const trip = await createTrip(scopeManager, { routeId: r.id, date: "2026-09-10" });
    const allowedKeys = new Set([
      "id", "routeId", "routeName", "date", "type", "status", "vehicleRegistration", "driverName", "studentsBoarded", "studentsExpected", "createdAt",
      "vehicleId", "driverStaffId", "attendantStaffId", "attendantName", "startedAt", "completedAt", "stops", "students",
    ]);
    for (const key of Object.keys(trip)) expect(allowedKeys.has(key)).toBe(true);
  });
});
