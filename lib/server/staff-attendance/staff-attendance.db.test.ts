// Staff Attendance DB integration tests (Phase 9E.1). Real Postgres: roster
// from ACTIVE staff, upsert mark/correct (one row per staff per day), ON_LEAVE
// override guard, self-view vs roster-view authorization, percentage formula
// (null on zero counted days, ON_LEAVE excluded from denominator), isolation,
// concurrency. Namespaced ("T9E1").
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  getStaffAttendanceHistory,
  getStaffAttendancePercent,
  getStaffAttendanceRoster,
  getStaffAttendanceSummary,
  markStaffAttendance,
} from "@/lib/server/staff-attendance/service";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T9E1";
const stamp = Date.now().toString(36);

let tenantId = "", schoolId = "", branchA = "", sessionId = "";
let otherTenantId = "", otherSchoolId = "", otherBranchId = "", foreignStaffId = "";
let staff1Id = "", staff2Id = "", inactiveStaffId = "";
let scopeAdmin: OrgScope, scopeTeacher1: OrgScope, scopeTeacher2: OrgScope;
let adminUser = "", teacherUser1 = "", teacherUser2 = "";

async function makeUserWithRole(email: string, roleKey: string): Promise<string> {
  const u = await prisma.user.create({ data: { email, name: email, status: "ACTIVE" }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId, status: "ACTIVE" }, select: { id: true } });
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  return u.id;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t9e1-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;
  sessionId = (await prisma.academicSession.create({ data: { schoolId, name: "26-27", code: `${NS}-S`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;

  adminUser = await makeUserWithRole(`t9e1-admin-${stamp}@x.test`, "SCHOOL_ADMIN");
  teacherUser1 = await makeUserWithRole(`t9e1-t1-${stamp}@x.test`, "TEACHER");
  teacherUser2 = await makeUserWithRole(`t9e1-t2-${stamp}@x.test`, "TEACHER");

  staff1Id = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-T1`, firstName: "Tara", isTeaching: true, status: "ACTIVE", userId: teacherUser1 }, select: { id: true } })).id;
  staff2Id = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-T2`, firstName: "Vik", isTeaching: true, status: "ACTIVE", userId: teacherUser2 }, select: { id: true } })).id;
  inactiveStaffId = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-T3`, firstName: "Old", isTeaching: true, status: "INACTIVE" }, select: { id: true } })).id;

  // A second, fully separate tenant/school/staff — for cross-school isolation.
  otherTenantId = (await prisma.tenant.create({ data: { name: `${NS} T2`, slug: `t9e1-b-${stamp}` }, select: { id: true } })).id;
  otherSchoolId = (await prisma.school.create({ data: { tenantId: otherTenantId, name: `${NS} S2`, code: `${NS}-B-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  otherBranchId = (await prisma.branch.create({ data: { schoolId: otherSchoolId, name: "B", code: `${NS}-B`, status: "ACTIVE" }, select: { id: true } })).id;
  foreignStaffId = (await prisma.staff.create({ data: { tenantId: otherTenantId, schoolId: otherSchoolId, branchId: otherBranchId, employeeCode: `${NS}-F1`, firstName: "Foreign", status: "ACTIVE" }, select: { id: true } })).id;

  scopeAdmin = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: adminUser, name: "Admin" } };
  scopeTeacher1 = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: teacherUser1, name: "T1" } };
  scopeTeacher2 = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: teacherUser2, name: "T2" } };
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
  await prisma.staffAttendanceRecord.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
  await prisma.staff.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
  await prisma.roleAssignment.deleteMany({ where: { membership: { tenantId } } });
  await prisma.tenantMembership.deleteMany({ where: { tenantId } });
  await prisma.academicSession.deleteMany({ where: { schoolId } });
  await prisma.branch.deleteMany({ where: { schoolId: { in: [schoolId, otherSchoolId] } } });
  await prisma.school.deleteMany({ where: { tenantId: { in: [tenantId, otherTenantId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [adminUser, teacherUser1, teacherUser2] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } });
});

describe.skipIf(!dbReady)("Staff Attendance (DB)", () => {
  it("roster includes ACTIVE staff as not-marked and excludes INACTIVE staff", async () => {
    const date = "2026-09-01";
    const roster = await getStaffAttendanceRoster(scopeAdmin, { date });
    const ids = roster.map((r) => r.staffId);
    expect(ids).toContain(staff1Id);
    expect(ids).toContain(staff2Id);
    expect(ids).not.toContain(inactiveStaffId);
    expect(roster.find((r) => r.staffId === staff1Id)!.status).toBe("not-marked");
    expect(roster.find((r) => r.staffId === staff1Id)!.recordId).toBeNull();
  });

  it("marks attendance (upsert) and records an audit event", async () => {
    const date = "2026-09-02";
    await markStaffAttendance(scopeAdmin, { date, entries: [{ staffId: staff1Id, status: "present", checkInAt: "08:05", checkOutAt: "15:30" }] });
    const roster = await getStaffAttendanceRoster(scopeAdmin, { date });
    const row = roster.find((r) => r.staffId === staff1Id)!;
    expect(row.status).toBe("present");
    expect(row.checkInAt).toBe("08:05");
    const audit = await prisma.auditEvent.findFirst({ where: { tenantId, action: "STAFF_ATTENDANCE_MARKED", entityId: row.recordId! } });
    expect(audit).toBeTruthy();
  });

  it("re-marking the same staff/date UPDATES the same row — no duplicate", async () => {
    const date = "2026-09-03";
    await markStaffAttendance(scopeAdmin, { date, entries: [{ staffId: staff1Id, status: "present" }] });
    await markStaffAttendance(scopeAdmin, { date, entries: [{ staffId: staff1Id, status: "late", checkInAt: "09:10" }] });
    const count = await prisma.staffAttendanceRecord.count({ where: { staffId: staff1Id, date: new Date(`${date}T00:00:00.000Z`) } });
    expect(count).toBe(1);
    const roster = await getStaffAttendanceRoster(scopeAdmin, { date });
    expect(roster.find((r) => r.staffId === staff1Id)!.status).toBe("late");
    const updatedAudit = await prisma.auditEvent.findFirst({ where: { tenantId, action: "STAFF_ATTENDANCE_UPDATED" } });
    expect(updatedAudit).toBeTruthy();
  });

  it("a foreign (cross-school) staffId is rejected as NOT_FOUND", async () => {
    await expect(markStaffAttendance(scopeAdmin, { date: "2026-09-04", entries: [{ staffId: foreignStaffId, status: "present" }] })).rejects.toThrow(HttpError);
  });

  it("marking over an ON_LEAVE row without override is a CONFLICT; override succeeds", async () => {
    const date = "2026-09-05";
    await prisma.staffAttendanceRecord.create({ data: { tenantId, schoolId, branchId: branchA, staffId: staff1Id, date: new Date(`${date}T00:00:00.000Z`), status: "ON_LEAVE", markedByUserId: adminUser, markedByName: "Admin" } });
    await expect(markStaffAttendance(scopeAdmin, { date, entries: [{ staffId: staff1Id, status: "present" }] })).rejects.toThrow(HttpError);
    await markStaffAttendance(scopeAdmin, { date, entries: [{ staffId: staff1Id, status: "present", override: true }] });
    const roster = await getStaffAttendanceRoster(scopeAdmin, { date });
    expect(roster.find((r) => r.staffId === staff1Id)!.status).toBe("present");
  });

  it("percentage: PRESENT/LATE=1, HALF_DAY=0.5, ABSENT=0, ON_LEAVE excluded from the denominator", async () => {
    const from = "2026-10-01", to = "2026-10-05";
    await markStaffAttendance(scopeAdmin, {
      date: "2026-10-01", entries: [{ staffId: staff2Id, status: "present" }],
    });
    await markStaffAttendance(scopeAdmin, { date: "2026-10-02", entries: [{ staffId: staff2Id, status: "absent" }] });
    await markStaffAttendance(scopeAdmin, { date: "2026-10-03", entries: [{ staffId: staff2Id, status: "half-day" }] });
    await markStaffAttendance(scopeAdmin, { date: "2026-10-04", entries: [{ staffId: staff2Id, status: "late" }] });
    await markStaffAttendance(scopeAdmin, { date: "2026-10-05", entries: [{ staffId: staff2Id, status: "on-leave" }] });
    const percent = await getStaffAttendancePercent(scopeAdmin, staff2Id, { from, to });
    // countedDays = 4 (ON_LEAVE excluded); weighted = 1 + 0 + 0.5 + 1 = 2.5 -> 62.5%
    expect(percent.countedDays).toBe(4);
    expect(percent.percentage).toBe(62.5);
  });

  it("zero attendance days returns percentage: null, never a fake 0%", async () => {
    const percent = await getStaffAttendancePercent(scopeAdmin, inactiveStaffId, { from: "2020-01-01", to: "2020-01-31" });
    expect(percent.countedDays).toBe(0);
    expect(percent.percentage).toBeNull();
  });

  it("self-view: a teacher can view their own history without staffAttendance.view", async () => {
    const history = await getStaffAttendanceHistory(scopeTeacher1, staff1Id, { from: "2026-09-01", to: "2026-09-30" });
    expect(Array.isArray(history)).toBe(true);
  });

  it("Teacher A cannot view Teacher B's attendance history", async () => {
    await expect(getStaffAttendanceHistory(scopeTeacher2, staff1Id, { from: "2026-09-01", to: "2026-09-30" })).rejects.toThrow(HttpError);
  });

  it("summary counts add up and notMarked is honest (never folded into absent)", async () => {
    const date = "2026-11-01";
    await markStaffAttendance(scopeAdmin, { date, entries: [{ staffId: staff1Id, status: "present" }] });
    const summary = await getStaffAttendanceSummary(scopeAdmin, { date });
    expect(summary.present).toBeGreaterThanOrEqual(1);
    expect(summary.present + summary.absent + summary.late + summary.halfDay + summary.onLeave + summary.notMarked).toBe(summary.totalActiveStaff);
  });

  it("concurrent marks for the same staff/date never create a duplicate row", async () => {
    const date = "2026-11-15";
    await Promise.all([
      markStaffAttendance(scopeAdmin, { date, entries: [{ staffId: staff1Id, status: "present" }] }),
      markStaffAttendance(scopeAdmin, { date, entries: [{ staffId: staff1Id, status: "late" }] }),
    ]);
    const count = await prisma.staffAttendanceRecord.count({ where: { staffId: staff1Id, date: new Date(`${date}T00:00:00.000Z`) } });
    expect(count).toBe(1);
  });
});

describe.skipIf(!dbReady)("Staff Attendance RBAC (DB)", () => {
  it("staffAttendance.view/manage: SCHOOL_ADMIN/PRINCIPAL/HR_ADMIN have manage; TEACHER has neither (self-view only)", () => {
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("staffAttendance.manage");
    expect(ROLE_PERMISSIONS.PRINCIPAL).toContain("staffAttendance.manage");
    expect(ROLE_PERMISSIONS.HR_ADMIN).toContain("staffAttendance.manage");
    expect(ROLE_PERMISSIONS.TEACHER).not.toContain("staffAttendance.view");
    expect(ROLE_PERMISSIONS.TEACHER).not.toContain("staffAttendance.manage");
  });
});
