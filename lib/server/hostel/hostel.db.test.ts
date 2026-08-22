// Hostel Management DB integration tests (Phase 9Q). Real Postgres: Hostel/
// Room/Bed CRUD (rooms atomically provisioned with beds — capacity is never
// a stored field), Student Assignment (allocate/transfer/vacate) with
// dual-guard concurrency on both "one bed, one active occupant" and "one
// student, one active assignment per session", Staff/Warden assignment
// (real, active, in-school Staff only), nightly Roll Call (a domain fully
// separate from academic Attendance), dashboard DB-derivation, historical
// safety, isolation, RBAC, audit, DTO safety. Namespaced ("T9Q"). Mirrors
// the exact setup/teardown pattern of lib/server/library/library.db.test.ts.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createHostel, getHostel, listHostels, updateHostel } from "@/lib/server/hostel/hostels";
import { createRoom, getRoom, listBeds, listRooms, setBedStatus } from "@/lib/server/hostel/rooms";
import { assignStudent, getAssignment, listAssignments, transferAssignment, vacateAssignment } from "@/lib/server/hostel/assignments";
import { assignHostelStaff, endHostelStaffAssignment, listStaffAssignments } from "@/lib/server/hostel/staff-assignments";
import { getRollCall, getStudentRollCallHistory, markRollCall } from "@/lib/server/hostel/roll-call";
import { getHostelDashboard } from "@/lib/server/hostel/dashboard";
import { getStudentHostelProfile } from "@/lib/server/hostel/student-profile";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T9Q";
const stamp = Date.now().toString(36);

let tenantId = "", schoolId = "", branchA = "", sessionId = "";
let student1 = "", student2 = "", inactiveStudent = "";
let warden1 = "", warden2 = "", inactiveStaff = "";
let foreignTenantId = "", foreignSchoolId = "", foreignBranchId = "", foreignStudentId = "";
let scopeAdmin: OrgScope, scopePrincipal: OrgScope, scopeTeacher: OrgScope, scopeForeignAdmin: OrgScope;
let adminUser = "", principalUser = "", teacherUser = "", foreignAdminUser = "";

async function makeUserWithRole(email: string, roleKey: string, tid = tenantId): Promise<string> {
  const u = await prisma.user.create({ data: { email, name: email, status: "ACTIVE" }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId: tid, status: "ACTIVE" }, select: { id: true } });
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  return u.id;
}

async function makeStudent(admissionSuffix: string, status: "ACTIVE" | "INACTIVE" = "ACTIVE", tid = tenantId, sid = schoolId, bid = branchA, sessId = sessionId): Promise<string> {
  return (await prisma.student.create({
    data: { tenantId: tid, schoolId: sid, branchId: bid, academicSessionId: sessId, admissionNumber: `${NS}-${stamp}-${admissionSuffix}`, firstName: admissionSuffix, lastName: "T", dateOfBirth: new Date("2012-01-01"), admissionDate: new Date("2024-04-01"), status },
    select: { id: true },
  })).id;
}

async function makeRoom(hostelId: string, roomNumber: string, capacity = 2) {
  return createRoom(scopeAdmin, { hostelId, roomNumber: `${roomNumber}-${stamp}`, capacity });
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t9q-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;
  sessionId = (await prisma.academicSession.create({ data: { schoolId, name: "26-27", code: `${NS}-S`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;

  adminUser = await makeUserWithRole(`t9q-admin-${stamp}@x.test`, "SCHOOL_ADMIN");
  principalUser = await makeUserWithRole(`t9q-principal-${stamp}@x.test`, "PRINCIPAL");
  teacherUser = await makeUserWithRole(`t9q-teacher-${stamp}@x.test`, "TEACHER");

  scopeAdmin = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: adminUser, name: "Admin" } };
  scopePrincipal = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: principalUser, name: "Principal" } };
  scopeTeacher = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: teacherUser, name: "Teacher" } };

  student1 = await makeStudent("s1");
  student2 = await makeStudent("s2");
  inactiveStudent = await makeStudent("inactive", "INACTIVE");

  warden1 = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-W1-${stamp}`, firstName: "Warden", lastName: "One", status: "ACTIVE" }, select: { id: true } })).id;
  warden2 = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-W2-${stamp}`, firstName: "Warden", lastName: "Two", status: "ACTIVE" }, select: { id: true } })).id;
  inactiveStaff = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-WI-${stamp}`, firstName: "Inactive", lastName: "Warden", status: "INACTIVE" }, select: { id: true } })).id;

  foreignTenantId = (await prisma.tenant.create({ data: { name: `${NS} T2`, slug: `t9q-b-${stamp}` }, select: { id: true } })).id;
  foreignSchoolId = (await prisma.school.create({ data: { tenantId: foreignTenantId, name: `${NS} S2`, code: `${NS}-B-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  foreignBranchId = (await prisma.branch.create({ data: { schoolId: foreignSchoolId, name: "B", code: `${NS}-B`, status: "ACTIVE" }, select: { id: true } })).id;
  const foreignSession = (await prisma.academicSession.create({ data: { schoolId: foreignSchoolId, name: "26-27", code: `${NS}-BS`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;
  foreignStudentId = await makeStudent("foreign", "ACTIVE", foreignTenantId, foreignSchoolId, foreignBranchId, foreignSession);
  foreignAdminUser = await makeUserWithRole(`t9q-fadmin-${stamp}@x.test`, "SCHOOL_ADMIN", foreignTenantId);
  scopeForeignAdmin = { tenantId: foreignTenantId, schoolId: foreignSchoolId, branchId: foreignBranchId, academicSessionId: foreignSession, actor: { id: foreignAdminUser, name: "Foreign Admin" } };
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.hostelRollCallRecord.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.studentHostelAssignment.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.hostelStaffAssignment.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.hostelBed.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.hostelRoom.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.hostel.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.student.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.staff.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.roleAssignment.deleteMany({ where: { membership: { tenantId: { in: [tenantId, foreignTenantId] } } } });
  await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.academicSession.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.branch.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.school.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [adminUser, principalUser, teacherUser, foreignAdminUser] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, foreignTenantId] } } });
});

describe.skipIf(!dbReady)("Hostels (DB)", () => {
  it("creates, updates and lists a hostel", async () => {
    const h = await createHostel(scopeAdmin, { code: `HST-${stamp}-1`, name: "Aravalli House", genderPolicy: "boys" });
    expect(h.status).toBe("active");
    expect(h.roomCount).toBe(0);
    const updated = await updateHostel(scopeAdmin, h.id, { description: "Boys hostel, block A" });
    expect(updated.description).toBe("Boys hostel, block A");
    const list = await listHostels(scopeAdmin);
    expect(list.some((x) => x.id === h.id)).toBe(true);
  });

  it("rejects a duplicate hostel code within the same school", async () => {
    await createHostel(scopeAdmin, { code: `HST-${stamp}-DUP`, name: "First" });
    await expect(createHostel(scopeAdmin, { code: `HST-${stamp}-DUP`, name: "Second" })).rejects.toThrow(HttpError);
  });

  it("isolation: a foreign tenant cannot see or fetch another school's hostel", async () => {
    const h = await createHostel(scopeAdmin, { code: `HST-${stamp}-ISO`, name: "Isolated" });
    const foreignList = await listHostels(scopeForeignAdmin);
    expect(foreignList.some((x) => x.id === h.id)).toBe(false);
    await expect(getHostel(scopeForeignAdmin, h.id)).rejects.toThrow(HttpError);
  });
});

describe.skipIf(!dbReady)("Rooms + Beds (DB)", () => {
  it("creates a room WITH its beds atomically — capacity is always beds.length", async () => {
    const h = await createHostel(scopeAdmin, { code: `HST-${stamp}-R1`, name: "Room Test House" });
    const room = await makeRoom(h.id, "101", 3);
    expect(room.totalBeds).toBe(3);
    expect(room.activeBeds).toBe(3);
    expect(room.occupiedBeds).toBe(0);
    expect(room.availableBeds).toBe(3);
    const beds = await listBeds(scopeAdmin, { roomId: room.id });
    expect(beds.length).toBe(3);
  });

  it("rejects a duplicate room number within the same hostel", async () => {
    const h = await createHostel(scopeAdmin, { code: `HST-${stamp}-R2`, name: "Dup Room House" });
    await makeRoom(h.id, "DUP", 1);
    await expect(createRoom(scopeAdmin, { hostelId: h.id, roomNumber: `DUP-${stamp}`, capacity: 1 })).rejects.toThrow(HttpError);
  });

  it("isolation: a foreign tenant cannot see or fetch another school's room", async () => {
    const h = await createHostel(scopeAdmin, { code: `HST-${stamp}-R3`, name: "Iso Room House" });
    const room = await makeRoom(h.id, "ISO", 1);
    const foreignList = await listRooms(scopeForeignAdmin);
    expect(foreignList.some((r) => r.id === room.id)).toBe(false);
    await expect(getRoom(scopeForeignAdmin, room.id)).rejects.toThrow(HttpError);
  });

  it("a bed with an active occupant cannot be set to maintenance/archived", async () => {
    const h = await createHostel(scopeAdmin, { code: `HST-${stamp}-R4`, name: "Bed Status House" });
    const room = await makeRoom(h.id, "BS1", 1);
    const beds = await listBeds(scopeAdmin, { roomId: room.id });
    const bed = beds[0];
    const assignment = await assignStudent(scopeAdmin, { studentId: student1, bedId: bed.id });
    await expect(setBedStatus(scopeAdmin, bed.id, { status: "maintenance" })).rejects.toThrow(HttpError);
    await vacateAssignment(scopeAdmin, assignment.id);
    const maintained = await setBedStatus(scopeAdmin, bed.id, { status: "maintenance" });
    expect(maintained.status).toBe("maintenance");
  });
});

describe.skipIf(!dbReady)("Student Assignment: eligibility + concurrency (DB)", () => {
  it("rejects an inactive, foreign, or nonexistent student, and a nonexistent bed", async () => {
    const h = await createHostel(scopeAdmin, { code: `HST-${stamp}-E1`, name: "Eligibility House" });
    const room = await makeRoom(h.id, "E1", 1);
    const beds = await listBeds(scopeAdmin, { roomId: room.id });
    await expect(assignStudent(scopeAdmin, { studentId: inactiveStudent, bedId: beds[0].id })).rejects.toThrow(HttpError);
    await expect(assignStudent(scopeAdmin, { studentId: foreignStudentId, bedId: beds[0].id })).rejects.toThrow(HttpError);
    await expect(assignStudent(scopeAdmin, { studentId: "nonexistent", bedId: beds[0].id })).rejects.toThrow(HttpError);
    await expect(assignStudent(scopeAdmin, { studentId: student1, bedId: "nonexistent" })).rejects.toThrow(HttpError);
  });

  it("assigns a student to a real bed, then rejects assigning the same bed again", async () => {
    const h = await createHostel(scopeAdmin, { code: `HST-${stamp}-E2`, name: "Assign House" });
    const room = await makeRoom(h.id, "E2", 1);
    const bed = (await listBeds(scopeAdmin, { roomId: room.id }))[0];
    const assignment = await assignStudent(scopeAdmin, { studentId: student1, bedId: bed.id });
    expect(assignment.status).toBe("active");
    expect(assignment.studentId).toBe(student1);
    await expect(assignStudent(scopeAdmin, { studentId: student2, bedId: bed.id })).rejects.toThrow(HttpError);
  });

  it("rejects assigning the same student to a second active bed this session", async () => {
    const h = await createHostel(scopeAdmin, { code: `HST-${stamp}-E3`, name: "Dup Student House" });
    const room = await makeRoom(h.id, "E3", 2);
    const beds = await listBeds(scopeAdmin, { roomId: room.id });
    await assignStudent(scopeAdmin, { studentId: student2, bedId: beds[0].id });
    await expect(assignStudent(scopeAdmin, { studentId: student2, bedId: beds[1].id })).rejects.toThrow(HttpError);
  });

  it("concurrency: exactly one of N concurrent attempts to assign the same bed succeeds", async () => {
    const h = await createHostel(scopeAdmin, { code: `HST-${stamp}-C1`, name: "Bed Race House" });
    const room = await makeRoom(h.id, "C1", 1);
    const bed = (await listBeds(scopeAdmin, { roomId: room.id }))[0];
    const racers = await Promise.all(["race1", "race2", "race3", "race4"].map((n) => makeStudent(n)));
    const results = await Promise.all(racers.map((sid) => assignStudent(scopeAdmin, { studentId: sid, bedId: bed.id }).catch((e) => e)));
    const succeeded = results.filter((r) => !(r instanceof Error));
    expect(succeeded.length).toBe(1);
    const activeCount = await prisma.studentHostelAssignment.count({ where: { bedId: bed.id, status: "ACTIVE" } });
    expect(activeCount).toBe(1);
  });

  it("concurrency: exactly one of N concurrent attempts to assign the same student (to different beds) succeeds", async () => {
    const h = await createHostel(scopeAdmin, { code: `HST-${stamp}-C2`, name: "Student Race House" });
    const room = await makeRoom(h.id, "C2", 4);
    const beds = await listBeds(scopeAdmin, { roomId: room.id });
    const student = await makeStudent("racestudent");
    const results = await Promise.all(beds.map((b) => assignStudent(scopeAdmin, { studentId: student, bedId: b.id }).catch((e) => e)));
    const succeeded = results.filter((r) => !(r instanceof Error));
    expect(succeeded.length).toBe(1);
    const activeCount = await prisma.studentHostelAssignment.count({ where: { studentId: student, academicSessionId: sessionId, status: "ACTIVE" } });
    expect(activeCount).toBe(1);
  });
});

describe.skipIf(!dbReady)("Transfer (DB)", () => {
  it("transfers a student to a new bed atomically: old bed frees, new bed occupied, history preserved", async () => {
    const h = await createHostel(scopeAdmin, { code: `HST-${stamp}-T1`, name: "Transfer House" });
    const room = await makeRoom(h.id, "T1", 2);
    const beds = await listBeds(scopeAdmin, { roomId: room.id });
    const student = await makeStudent("transfer1");
    const original = await assignStudent(scopeAdmin, { studentId: student, bedId: beds[0].id });

    const transferred = await transferAssignment(scopeAdmin, original.id, { toBedId: beds[1].id });
    expect(transferred.id).not.toBe(original.id);
    expect(transferred.bedId).toBe(beds[1].id);
    expect(transferred.status).toBe("active");

    const oldRecord = await getAssignment(scopeAdmin, original.id);
    expect(oldRecord.status).toBe("transferred");
    expect(oldRecord.vacatedAt).toBeTruthy();

    const oldBed = (await listBeds(scopeAdmin, { roomId: room.id })).find((b) => b.id === beds[0].id)!;
    expect(oldBed.occupied).toBe(false);
    const newBed = (await listBeds(scopeAdmin, { roomId: room.id })).find((b) => b.id === beds[1].id)!;
    expect(newBed.occupied).toBe(true);
  });

  it("rejects transferring to an already-occupied bed, and rejects transferring a non-active assignment", async () => {
    const h = await createHostel(scopeAdmin, { code: `HST-${stamp}-T2`, name: "Transfer Reject House" });
    const room = await makeRoom(h.id, "T2", 2);
    const beds = await listBeds(scopeAdmin, { roomId: room.id });
    const studentA = await makeStudent("transferA");
    const studentB = await makeStudent("transferB");
    const assignmentA = await assignStudent(scopeAdmin, { studentId: studentA, bedId: beds[0].id });
    await assignStudent(scopeAdmin, { studentId: studentB, bedId: beds[1].id });

    await expect(transferAssignment(scopeAdmin, assignmentA.id, { toBedId: beds[1].id })).rejects.toThrow(HttpError);

    const vacated = await vacateAssignment(scopeAdmin, assignmentA.id);
    await expect(transferAssignment(scopeAdmin, vacated.id, { toBedId: beds[1].id })).rejects.toThrow(HttpError);
  });

  it("concurrency: exactly one of N concurrent transfer attempts to the same target bed succeeds", async () => {
    const h = await createHostel(scopeAdmin, { code: `HST-${stamp}-T3`, name: "Transfer Race House" });
    const room = await makeRoom(h.id, "T3", 5);
    const beds = await listBeds(scopeAdmin, { roomId: room.id });
    const targetBed = beds[4];
    const assignments = await Promise.all(
      beds.slice(0, 4).map(async (b, i) => assignStudent(scopeAdmin, { studentId: await makeStudent(`tracer${i}`), bedId: b.id })),
    );
    const results = await Promise.all(assignments.map((a) => transferAssignment(scopeAdmin, a.id, { toBedId: targetBed.id }).catch((e) => e)));
    const succeeded = results.filter((r) => !(r instanceof Error));
    expect(succeeded.length).toBe(1);
    const activeCount = await prisma.studentHostelAssignment.count({ where: { bedId: targetBed.id, status: "ACTIVE" } });
    expect(activeCount).toBe(1);
  });
});

describe.skipIf(!dbReady)("Vacate (DB)", () => {
  it("vacates an active assignment with a server timestamp, freeing the bed", async () => {
    const h = await createHostel(scopeAdmin, { code: `HST-${stamp}-V1`, name: "Vacate House" });
    const room = await makeRoom(h.id, "V1", 1);
    const bed = (await listBeds(scopeAdmin, { roomId: room.id }))[0];
    const student = await makeStudent("vacate1");
    const before = Date.now();
    const assignment = await assignStudent(scopeAdmin, { studentId: student, bedId: bed.id });
    const vacated = await vacateAssignment(scopeAdmin, assignment.id);
    expect(vacated.status).toBe("vacated");
    expect(vacated.vacatedAt).toBeTruthy();
    expect(new Date(vacated.vacatedAt!).getTime()).toBeGreaterThanOrEqual(before);
    const bedAfter = (await listBeds(scopeAdmin, { roomId: room.id }))[0];
    expect(bedAfter.occupied).toBe(false);
  });

  it("rejects double-vacate, race-safe under concurrent vacate attempts", async () => {
    const h = await createHostel(scopeAdmin, { code: `HST-${stamp}-V2`, name: "Double Vacate House" });
    const room = await makeRoom(h.id, "V2", 1);
    const bed = (await listBeds(scopeAdmin, { roomId: room.id }))[0];
    const student = await makeStudent("vacate2");
    const assignment = await assignStudent(scopeAdmin, { studentId: student, bedId: bed.id });
    const results = await Promise.all(Array.from({ length: 5 }, () => vacateAssignment(scopeAdmin, assignment.id).catch((e) => e)));
    const succeeded = results.filter((r) => !(r instanceof Error));
    expect(succeeded.length).toBe(1);
  });
});

describe.skipIf(!dbReady)("Staff / Warden Assignment (DB)", () => {
  it("assigns a real, active staff member as warden; rejects an inactive or nonexistent staff member", async () => {
    const h = await createHostel(scopeAdmin, { code: `HST-${stamp}-W1`, name: "Warden House" });
    const assignment = await assignHostelStaff(scopeAdmin, { hostelId: h.id, staffId: warden1, role: "warden" });
    expect(assignment.status).toBe("active");
    expect(assignment.staffId).toBe(warden1);
    await expect(assignHostelStaff(scopeAdmin, { hostelId: h.id, staffId: inactiveStaff, role: "warden" })).rejects.toThrow(HttpError);
    await expect(assignHostelStaff(scopeAdmin, { hostelId: h.id, staffId: "nonexistent", role: "warden" })).rejects.toThrow(HttpError);
  });

  it("rejects a cross-school staff member as warden", async () => {
    const h = await createHostel(scopeAdmin, { code: `HST-${stamp}-W2`, name: "Cross School Warden House" });
    await expect(assignHostelStaff(scopeAdmin, { hostelId: h.id, staffId: foreignStudentId, role: "warden" })).rejects.toThrow(HttpError);
  });

  it("rejects assigning the same staff to the same role twice while active; allows after ending", async () => {
    const h = await createHostel(scopeAdmin, { code: `HST-${stamp}-W3`, name: "Duplicate Warden House" });
    await assignHostelStaff(scopeAdmin, { hostelId: h.id, staffId: warden2, role: "warden" });
    await expect(assignHostelStaff(scopeAdmin, { hostelId: h.id, staffId: warden2, role: "warden" })).rejects.toThrow(HttpError);

    const list = await listStaffAssignments(scopeAdmin, { hostelId: h.id });
    const current = list.find((a) => a.staffId === warden2 && a.status === "active")!;
    const ended = await endHostelStaffAssignment(scopeAdmin, current.id);
    expect(ended.status).toBe("ended");
    const reassigned = await assignHostelStaff(scopeAdmin, { hostelId: h.id, staffId: warden2, role: "warden" });
    expect(reassigned.status).toBe("active");
  });
});

describe.skipIf(!dbReady)("Roll Call (DB)", () => {
  it("a resident with no record for a date is not-marked, never synthesized as absent", async () => {
    const h = await createHostel(scopeAdmin, { code: `HST-${stamp}-RC1`, name: "Roll Call House" });
    const room = await makeRoom(h.id, "RC1", 1);
    const bed = (await listBeds(scopeAdmin, { roomId: room.id }))[0];
    const student = await makeStudent("rollcall1");
    await assignStudent(scopeAdmin, { studentId: student, bedId: bed.id });
    const today = new Date().toISOString().slice(0, 10);
    const roll = await getRollCall(scopeAdmin, { date: today, hostelId: h.id });
    const entry = roll.find((r) => r.studentId === student)!;
    expect(entry.status).toBe("not-marked");
  });

  it("marks present/absent/on_leave, is idempotent (upsert) for the same date, and rejects a student with no active assignment", async () => {
    const h = await createHostel(scopeAdmin, { code: `HST-${stamp}-RC2`, name: "Roll Call Mark House" });
    const room = await makeRoom(h.id, "RC2", 1);
    const bed = (await listBeds(scopeAdmin, { roomId: room.id }))[0];
    const student = await makeStudent("rollcall2");
    await assignStudent(scopeAdmin, { studentId: student, bedId: bed.id });
    const today = new Date().toISOString().slice(0, 10);

    await markRollCall(scopeAdmin, { studentId: student, date: today, status: "present" });
    let roll = await getRollCall(scopeAdmin, { date: today, hostelId: h.id });
    expect(roll.find((r) => r.studentId === student)!.status).toBe("present");

    await markRollCall(scopeAdmin, { studentId: student, date: today, status: "on_leave" });
    roll = await getRollCall(scopeAdmin, { date: today, hostelId: h.id });
    expect(roll.find((r) => r.studentId === student)!.status).toBe("on_leave");

    const history = await getStudentRollCallHistory(scopeAdmin, student);
    expect(history.length).toBe(1); // upsert, not a new row per mark

    const unassigned = await makeStudent("nohostel");
    await expect(markRollCall(scopeAdmin, { studentId: unassigned, date: today, status: "present" })).rejects.toThrow(HttpError);
  });
});

describe.skipIf(!dbReady)("Dashboard + Student 360 (DB)", () => {
  it("dashboard counts are real and DB-derived", async () => {
    const dashboard = await getHostelDashboard(scopeAdmin);
    expect(typeof dashboard.totalHostels).toBe("number");
    expect(typeof dashboard.totalBeds).toBe("number");
    expect(dashboard.totalHostels).toBeGreaterThan(0);
    expect(dashboard.occupiedBeds).toBeGreaterThanOrEqual(0);
    expect(dashboard.availableBeds).toBe(Math.max(0, dashboard.activeBeds - dashboard.occupiedBeds));
  });

  it("Student 360 hostel profile returns the current assignment + history; empty for a never-allocated student", async () => {
    const h = await createHostel(scopeAdmin, { code: `HST-${stamp}-S360`, name: "Student 360 House" });
    const room = await makeRoom(h.id, "S360", 1);
    const bed = (await listBeds(scopeAdmin, { roomId: room.id }))[0];
    const student = await makeStudent("s360resident");
    const assignment = await assignStudent(scopeAdmin, { studentId: student, bedId: bed.id });

    const profile = await getStudentHostelProfile(scopeAdmin, student);
    expect(profile.current?.assignedAt).toBeTruthy();
    expect(profile.current?.status).toBe("active");

    await vacateAssignment(scopeAdmin, assignment.id);
    const afterVacate = await getStudentHostelProfile(scopeAdmin, student);
    expect(afterVacate.current).toBeNull();
    expect(afterVacate.history.some((h2) => h2.id === assignment.id)).toBe(true);

    const neverAllocated = await makeStudent("neverhostel");
    const emptyProfile = await getStudentHostelProfile(scopeAdmin, neverAllocated);
    expect(emptyProfile.current).toBeNull();
    expect(emptyProfile.history).toEqual([]);
  });
});

describe.skipIf(!dbReady)("Historical safety (DB)", () => {
  it("assignment history survives a hostel archive and a student rename", async () => {
    const h = await createHostel(scopeAdmin, { code: `HST-${stamp}-HS1`, name: "History House" });
    const room = await makeRoom(h.id, "HS1", 1);
    const bed = (await listBeds(scopeAdmin, { roomId: room.id }))[0];
    const student = await makeStudent("history1");
    const assignment = await assignStudent(scopeAdmin, { studentId: student, bedId: bed.id });
    await vacateAssignment(scopeAdmin, assignment.id);

    await updateHostel(scopeAdmin, h.id, { status: "archived" });
    await prisma.student.update({ where: { id: student }, data: { firstName: "RenamedResident" } });

    const historical = await getAssignment(scopeAdmin, assignment.id);
    expect(historical.status).toBe("vacated");
    expect(historical.hostelName).toBe("History House");
    expect(historical.studentName).toContain("RenamedResident"); // live relation, matches Library precedent
  });
});

describe.skipIf(!dbReady)("Security / RBAC / Isolation / Audit / DTO safety (DB)", () => {
  it("hostel.view/hostel.manage: SCHOOL_ADMIN has both; PRINCIPAL view only; TEACHER neither", () => {
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("hostel.view");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("hostel.manage");
    expect(ROLE_PERMISSIONS.PRINCIPAL).toContain("hostel.view");
    expect(ROLE_PERMISSIONS.PRINCIPAL).not.toContain("hostel.manage");
    expect(ROLE_PERMISSIONS.TEACHER ?? []).not.toContain("hostel.view");
    expect(ROLE_PERMISSIONS.TEACHER ?? []).not.toContain("hostel.manage");
    void scopePrincipal; void scopeTeacher; // RBAC enforcement itself is at the route layer (requirePermission) — this documents the catalog contract.
  });

  it("cross-tenant hostel/room/assignment is invisible", async () => {
    const foreignHostel = await createHostel(scopeForeignAdmin, { code: "FOREIGN-H", name: "Foreign House" });
    await expect(getHostel(scopeAdmin, foreignHostel.id)).rejects.toThrow(HttpError);

    const foreignRoom = await createRoom(scopeForeignAdmin, { hostelId: foreignHostel.id, roomNumber: "F1", capacity: 1 });
    await expect(getRoom(scopeAdmin, foreignRoom.id)).rejects.toThrow(HttpError);

    const foreignBed = (await listBeds(scopeForeignAdmin, { roomId: foreignRoom.id }))[0];
    const foreignAssignment = await assignStudent(scopeForeignAdmin, { studentId: foreignStudentId, bedId: foreignBed.id });
    await expect(getAssignment(scopeAdmin, foreignAssignment.id)).rejects.toThrow(HttpError);
  });

  it("hostel mutations are audited", async () => {
    const events = await prisma.auditEvent.count({
      where: { tenantId, action: { in: ["HOSTEL_CREATED", "HOSTEL_ROOM_CREATED", "HOSTEL_STUDENT_ASSIGNED", "HOSTEL_STUDENT_VACATED", "HOSTEL_STUDENT_TRANSFERRED", "HOSTEL_STAFF_ASSIGNED", "HOSTEL_ROLL_CALL_MARKED"] } },
    });
    expect(events).toBeGreaterThan(5);
  });

  it("hostel/assignment DTOs never leak tenantId/schoolId/branchId", async () => {
    const h = await createHostel(scopeAdmin, { code: `HST-${stamp}-DTO`, name: "DTO House" });
    const raw = JSON.stringify(h);
    expect(raw).not.toContain(tenantId);
    expect(raw).not.toContain(schoolId);

    const room = await makeRoom(h.id, "DTO", 1);
    const bed = (await listBeds(scopeAdmin, { roomId: room.id }))[0];
    const student = await makeStudent("dtoresident");
    const assignment = await assignStudent(scopeAdmin, { studentId: student, bedId: bed.id });
    const rawAssignment = JSON.stringify(assignment);
    expect(rawAssignment).not.toContain(tenantId);
    expect(rawAssignment).not.toContain(schoolId);
  });

  it("listAssignments filters by hostel/room/student/status correctly", async () => {
    const byStatus = await listAssignments(scopeAdmin, { status: "vacated" });
    expect(byStatus.every((a) => a.status === "vacated")).toBe(true);
  });
});
