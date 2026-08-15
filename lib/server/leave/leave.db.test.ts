// Leave Management DB integration tests (Phase 9E.2). Real Postgres: LeaveType
// CRUD, self-service LeaveRequest submission (staffId resolved from the
// actor's own Staff.userId), date validation, overlap prevention (row-locked),
// approve/reject/cancel lifecycle + concurrency, ON_LEAVE write-through onto
// StaffAttendanceRecord, own-vs-broad-manager visibility, real notification
// fanout (incl. the "no linked User" no-op case), isolation, RBAC, audit.
// Namespaced ("T9E2").
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  approveLeaveRequest,
  cancelLeaveRequest,
  createLeaveRequest,
  createLeaveType,
  listLeaveRequests,
  rejectLeaveRequest,
  updateLeaveType,
} from "@/lib/server/leave/service";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T9E2";
const stamp = Date.now().toString(36);

let tenantId = "", schoolId = "", branchA = "", sessionId = "";
let staff1Id = "", staff2Id = "", staffNoUserId = "", foreignStaffId = "", foreignTenantId = "", foreignSchoolId = "";
let leaveTypeId = "";
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
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t9e2-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;
  sessionId = (await prisma.academicSession.create({ data: { schoolId, name: "26-27", code: `${NS}-S`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;

  adminUser = await makeUserWithRole(`t9e2-admin-${stamp}@x.test`, "SCHOOL_ADMIN");
  teacherUser1 = await makeUserWithRole(`t9e2-t1-${stamp}@x.test`, "TEACHER");
  teacherUser2 = await makeUserWithRole(`t9e2-t2-${stamp}@x.test`, "TEACHER");

  // The admin also needs a real Staff.userId link to be a valid notification
  // recipient (Notification recipients are always resolved via Staff.userId —
  // see lib/server/notifications/service.ts's doc comment).
  await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-ADM`, firstName: "Admin", isTeaching: false, status: "ACTIVE", userId: adminUser } });
  staff1Id = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-T1`, firstName: "Tara", isTeaching: true, status: "ACTIVE", userId: teacherUser1 }, select: { id: true } })).id;
  staff2Id = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-T2`, firstName: "Vik", isTeaching: true, status: "ACTIVE", userId: teacherUser2 }, select: { id: true } })).id;
  staffNoUserId = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-T3`, firstName: "NoAccount", isTeaching: true, status: "ACTIVE" }, select: { id: true } })).id;

  foreignTenantId = (await prisma.tenant.create({ data: { name: `${NS} T2`, slug: `t9e2-b-${stamp}` }, select: { id: true } })).id;
  foreignSchoolId = (await prisma.school.create({ data: { tenantId: foreignTenantId, name: `${NS} S2`, code: `${NS}-B-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  const foreignBranchId = (await prisma.branch.create({ data: { schoolId: foreignSchoolId, name: "B", code: `${NS}-B`, status: "ACTIVE" }, select: { id: true } })).id;
  foreignStaffId = (await prisma.staff.create({ data: { tenantId: foreignTenantId, schoolId: foreignSchoolId, branchId: foreignBranchId, employeeCode: `${NS}-F1`, firstName: "Foreign", status: "ACTIVE" }, select: { id: true } })).id;

  scopeAdmin = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: adminUser, name: "Admin" } };
  scopeTeacher1 = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: teacherUser1, name: "T1" } };
  scopeTeacher2 = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: teacherUser2, name: "T2" } };

  leaveTypeId = (await createLeaveType(scopeAdmin, { name: `Casual ${stamp}`, code: `CAS${stamp}` })).id;
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.notificationRecipient.deleteMany({ where: { notification: { tenantId: { in: [tenantId, foreignTenantId] } } } });
  await prisma.notification.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.auditEvent.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.leaveRequest.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.staffAttendanceRecord.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.leaveType.deleteMany({ where: { tenantId } });
  await prisma.staff.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.roleAssignment.deleteMany({ where: { membership: { tenantId } } });
  await prisma.tenantMembership.deleteMany({ where: { tenantId } });
  await prisma.academicSession.deleteMany({ where: { schoolId } });
  await prisma.branch.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.school.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [adminUser, teacherUser1, teacherUser2] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, foreignTenantId] } } });
});

describe.skipIf(!dbReady)("Leave Types (DB)", () => {
  it("SCHOOL_ADMIN creates a leave type; a duplicate code is rejected", async () => {
    await expect(createLeaveType(scopeAdmin, { name: "Dup", code: `CAS${stamp}` })).rejects.toThrow(HttpError);
  });

  it("TEACHER cannot create a leave type", async () => {
    await expect(createLeaveType(scopeTeacher1, { name: "X", code: `X${stamp}` })).rejects.toThrow(HttpError);
  });

  it("updates a leave type", async () => {
    const updated = await updateLeaveType(scopeAdmin, leaveTypeId, { isPaid: false });
    expect(updated.isPaid).toBe(false);
    await updateLeaveType(scopeAdmin, leaveTypeId, { isPaid: true });
  });
});

describe.skipIf(!dbReady)("Leave Requests (DB)", () => {
  it("self-service: a teacher's request resolves staffId from their own Staff.userId link", async () => {
    const req = await createLeaveRequest(scopeTeacher1, { leaveTypeId, startDate: "2026-09-10", endDate: "2026-09-11", reason: "Family event" });
    expect(req.staffId).toBe(staff1Id);
    expect(req.status).toBe("pending");
  });

  it("INVALID_LEAVE_DATES: startDate after endDate is rejected", async () => {
    await expect(createLeaveRequest(scopeTeacher2, { leaveTypeId, startDate: "2026-09-20", endDate: "2026-09-19", reason: "x" })).rejects.toThrow(HttpError);
  });

  it("LEAVE_OVERLAP: a second pending/approved request overlapping an existing one is rejected", async () => {
    await createLeaveRequest(scopeTeacher2, { leaveTypeId, startDate: "2026-10-01", endDate: "2026-10-03", reason: "First" });
    await expect(createLeaveRequest(scopeTeacher2, { leaveTypeId, startDate: "2026-10-02", endDate: "2026-10-05", reason: "Overlaps" })).rejects.toThrow(HttpError);
  });

  it("a broad manager reviewer is notified when a request is submitted", async () => {
    const req = await createLeaveRequest(scopeTeacher1, { leaveTypeId, startDate: "2026-09-15", endDate: "2026-09-15", reason: "Appointment" });
    const notif = await prisma.notification.findUnique({ where: { dedupeKey: `LEAVE_REQUEST_SUBMITTED:${req.id}` }, include: { recipients: true } });
    expect(notif).toBeTruthy();
    expect(notif!.recipients.some((r) => r.userId === adminUser)).toBe(true);
  });

  it("approving writes ON_LEAVE onto StaffAttendanceRecord for every covered date and notifies the requester", async () => {
    const req = await createLeaveRequest(scopeTeacher1, { leaveTypeId, startDate: "2026-11-02", endDate: "2026-11-04", reason: "Trip" });
    await approveLeaveRequest(scopeAdmin, req.id);
    const records = await prisma.staffAttendanceRecord.findMany({ where: { staffId: staff1Id, date: { gte: new Date("2026-11-02"), lte: new Date("2026-11-04") } } });
    expect(records.length).toBe(3);
    expect(records.every((r) => r.status === "ON_LEAVE")).toBe(true);
    const notif = await prisma.notification.findUnique({ where: { dedupeKey: `LEAVE_REQUEST_APPROVED:${req.id}` }, include: { recipients: true } });
    expect(notif!.recipients.some((r) => r.userId === teacherUser1)).toBe(true);
  });

  it("approving a non-PENDING request is a CONFLICT (concurrency-safe transition guard)", async () => {
    const req = await createLeaveRequest(scopeTeacher1, { leaveTypeId, startDate: "2026-11-20", endDate: "2026-11-20", reason: "x" });
    await approveLeaveRequest(scopeAdmin, req.id);
    await expect(approveLeaveRequest(scopeAdmin, req.id)).rejects.toThrow(HttpError);
  });

  it("concurrent approve calls only ever succeed once", async () => {
    const req = await createLeaveRequest(scopeTeacher1, { leaveTypeId, startDate: "2026-12-01", endDate: "2026-12-01", reason: "x" });
    const results = await Promise.allSettled([approveLeaveRequest(scopeAdmin, req.id), approveLeaveRequest(scopeAdmin, req.id)]);
    const fulfilled = results.filter((r) => r.status === "fulfilled").length;
    expect(fulfilled).toBe(1);
  });

  it("rejecting requires a note and notifies the requester", async () => {
    const req = await createLeaveRequest(scopeTeacher2, { leaveTypeId, startDate: "2026-12-10", endDate: "2026-12-10", reason: "x" });
    const rejected = await rejectLeaveRequest(scopeAdmin, req.id, { reviewNote: "No coverage available" });
    expect(rejected.status).toBe("rejected");
    expect(rejected.reviewNote).toBe("No coverage available");
    const notif = await prisma.notification.findUnique({ where: { dedupeKey: `LEAVE_REQUEST_REJECTED:${req.id}` }, include: { recipients: true } });
    expect(notif!.recipients.some((r) => r.userId === teacherUser2)).toBe(true);
  });

  it("a TEACHER cannot approve or reject any request (their own or another's)", async () => {
    const req = await createLeaveRequest(scopeTeacher2, { leaveTypeId, startDate: "2026-12-15", endDate: "2026-12-15", reason: "x" });
    await expect(approveLeaveRequest(scopeTeacher1, req.id)).rejects.toThrow(HttpError);
    await expect(rejectLeaveRequest(scopeTeacher2, req.id, { reviewNote: "x" })).rejects.toThrow(HttpError);
  });

  it("cancel: own PENDING request succeeds; a non-owner without manager rights cannot cancel it", async () => {
    const req = await createLeaveRequest(scopeTeacher1, { leaveTypeId, startDate: "2026-12-20", endDate: "2026-12-20", reason: "x" });
    await expect(cancelLeaveRequest(scopeTeacher2, req.id)).rejects.toThrow(HttpError);
    const cancelled = await cancelLeaveRequest(scopeTeacher1, req.id);
    expect(cancelled.status).toBe("cancelled");
    await expect(cancelLeaveRequest(scopeTeacher1, req.id)).rejects.toThrow(HttpError);
  });

  it("own-vs-broad-manager visibility: a teacher sees only their own requests; the admin sees all", async () => {
    const mine = await listLeaveRequests(scopeTeacher1, {});
    expect(mine.every((r) => r.staffId === staff1Id)).toBe(true);
    const all = await listLeaveRequests(scopeAdmin, {});
    expect(all.some((r) => r.staffId === staff1Id)).toBe(true);
    expect(all.some((r) => r.staffId === staff2Id)).toBe(true);
  });

  it("a Staff with no linked User account produces no fake notification recipient", async () => {
    const req = await createLeaveRequest(scopeAdmin, { staffId: staffNoUserId, leaveTypeId, startDate: "2026-12-22", endDate: "2026-12-22", reason: "Recorded by admin" });
    await approveLeaveRequest(scopeAdmin, req.id);
    const notif = await prisma.notification.findUnique({ where: { dedupeKey: `LEAVE_REQUEST_APPROVED:${req.id}` } });
    expect(notif).toBeNull(); // createNotification no-ops on an empty recipient list
  });

  it("a foreign (cross-school) staffId cannot be used to record leave on someone's behalf", async () => {
    await expect(createLeaveRequest(scopeAdmin, { staffId: foreignStaffId, leaveTypeId, startDate: "2026-12-28", endDate: "2026-12-28", reason: "x" })).rejects.toThrow(HttpError);
  });
});

describe.skipIf(!dbReady)("Leave RBAC (DB)", () => {
  it("leave.submit/leave.approve: SCHOOL_ADMIN/PRINCIPAL/HR_ADMIN have both; TEACHER has submit only", () => {
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("leave.approve");
    expect(ROLE_PERMISSIONS.PRINCIPAL).toContain("leave.approve");
    expect(ROLE_PERMISSIONS.HR_ADMIN).toContain("leave.approve");
    expect(ROLE_PERMISSIONS.TEACHER).toContain("leave.submit");
    expect(ROLE_PERMISSIONS.TEACHER).not.toContain("leave.approve");
  });
});
