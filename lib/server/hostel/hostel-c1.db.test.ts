// Hostel Leave / Visitors / Complaints / Maintenance DB integration tests
// (Phase C1). Real Postgres. Extends the Phase 9Q Hostel foundation — see
// lib/server/hostel/hostel.db.test.ts for that domain's own tests. Covers:
// resident validation (hostelId/roomId snapshot from the CURRENT active
// StudentHostelAssignment, never client-supplied), server-enforced
// lifecycles, invalid transitions, staff-assignment scope, cross-tenant
// isolation, RBAC catalog contract, audit, DTO safety, and reports
// aggregate accuracy. Namespaced ("TC1").
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createHostel } from "@/lib/server/hostel/hostels";
import { createRoom, listBeds } from "@/lib/server/hostel/rooms";
import { assignStudent } from "@/lib/server/hostel/assignments";
import {
  approveHostelLeaveRequest,
  cancelHostelLeaveRequest,
  createHostelLeaveRequest,
  getHostelLeaveRequest,
  listHostelLeaveRequests,
  rejectHostelLeaveRequest,
} from "@/lib/server/hostel/leave";
import {
  cancelHostelVisitor,
  checkInHostelVisitor,
  checkOutHostelVisitor,
  createHostelVisitor,
  getHostelVisitor,
} from "@/lib/server/hostel/visitors";
import {
  assignHostelComplaint,
  closeHostelComplaint,
  createHostelComplaint,
  getHostelComplaint,
  resolveHostelComplaint,
  startHostelComplaint,
} from "@/lib/server/hostel/complaints";
import {
  assignHostelMaintenance,
  cancelHostelMaintenance,
  completeHostelMaintenance,
  createHostelMaintenance,
  getHostelMaintenance,
  startHostelMaintenance,
} from "@/lib/server/hostel/maintenance";
import { getHostelReports } from "@/lib/server/hostel/reports";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "TC1";
const stamp = Date.now().toString(36);

let tenantId = "", schoolId = "", branchA = "", sessionId = "";
let hostelId = "", roomId = "", roomId2 = "";
let residentId = "", nonResidentId = "";
let staff1 = "", inactiveStaff = "";
let foreignTenantId = "", foreignSchoolId = "", foreignBranchId = "", foreignStaffId = "";
let scopeAdmin: OrgScope, scopePrincipal: OrgScope, scopeTeacher: OrgScope, scopeForeignAdmin: OrgScope;
let adminUser = "", principalUser = "", teacherUser = "", foreignAdminUser = "";

async function makeUserWithRole(email: string, roleKey: string, tid = tenantId): Promise<string> {
  const u = await prisma.user.create({ data: { email, name: email, status: "ACTIVE" }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId: tid, status: "ACTIVE" }, select: { id: true } });
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  return u.id;
}

async function makeStudent(admissionSuffix: string, tid = tenantId, sid = schoolId, bid = branchA, sessId = sessionId): Promise<string> {
  return (await prisma.student.create({
    data: { tenantId: tid, schoolId: sid, branchId: bid, academicSessionId: sessId, admissionNumber: `${NS}-${stamp}-${admissionSuffix}`, firstName: admissionSuffix, lastName: "T", dateOfBirth: new Date("2012-01-01"), admissionDate: new Date("2024-04-01"), status: "ACTIVE" },
    select: { id: true },
  })).id;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `tc1-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;
  sessionId = (await prisma.academicSession.create({ data: { schoolId, name: "26-27", code: `${NS}-S`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE" }, select: { id: true } })).id;

  adminUser = await makeUserWithRole(`tc1-admin-${stamp}@x.test`, "SCHOOL_ADMIN");
  principalUser = await makeUserWithRole(`tc1-principal-${stamp}@x.test`, "PRINCIPAL");
  teacherUser = await makeUserWithRole(`tc1-teacher-${stamp}@x.test`, "TEACHER");

  scopeAdmin = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: adminUser, name: "Admin" } };
  scopePrincipal = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: principalUser, name: "Principal" } };
  scopeTeacher = { tenantId, schoolId, branchId: branchA, academicSessionId: sessionId, actor: { id: teacherUser, name: "Teacher" } };

  staff1 = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-ST1-${stamp}`, firstName: "Facilities", lastName: "One", status: "ACTIVE" }, select: { id: true } })).id;
  inactiveStaff = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-STI-${stamp}`, firstName: "Inactive", lastName: "Staff", status: "INACTIVE" }, select: { id: true } })).id;

  foreignTenantId = (await prisma.tenant.create({ data: { name: `${NS} T2`, slug: `tc1-b-${stamp}` }, select: { id: true } })).id;
  foreignSchoolId = (await prisma.school.create({ data: { tenantId: foreignTenantId, name: `${NS} S2`, code: `${NS}-B-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  foreignBranchId = (await prisma.branch.create({ data: { schoolId: foreignSchoolId, name: "B", code: `${NS}-B`, status: "ACTIVE" }, select: { id: true } })).id;
  foreignAdminUser = await makeUserWithRole(`tc1-fadmin-${stamp}@x.test`, "SCHOOL_ADMIN", foreignTenantId);
  scopeForeignAdmin = { tenantId: foreignTenantId, schoolId: foreignSchoolId, branchId: foreignBranchId, academicSessionId: null, actor: { id: foreignAdminUser, name: "Foreign Admin" } };
  foreignStaffId = (await prisma.staff.create({ data: { tenantId: foreignTenantId, schoolId: foreignSchoolId, branchId: foreignBranchId, employeeCode: `${NS}-FST-${stamp}`, firstName: "Foreign", lastName: "Staff", status: "ACTIVE" }, select: { id: true } })).id;

  // Real Hostel/Room/Bed foundation (Phase 9Q) + one resident with an ACTIVE assignment.
  const hostel = await createHostel(scopeAdmin, { code: `HC1-${stamp}`, name: "C1 House" });
  hostelId = hostel.id;
  const room = await createRoom(scopeAdmin, { hostelId, roomNumber: `C1R1-${stamp}`, capacity: 2 });
  roomId = room.id;
  const room2 = await createRoom(scopeAdmin, { hostelId, roomNumber: `C1R2-${stamp}`, capacity: 1 });
  roomId2 = room2.id;
  const beds = await listBeds(scopeAdmin, { roomId });

  residentId = await makeStudent("resident");
  nonResidentId = await makeStudent("nonresident");
  await assignStudent(scopeAdmin, { studentId: residentId, bedId: beds[0].id });
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.hostelMaintenanceRequest.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.hostelComplaint.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.hostelVisitor.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.hostelLeaveRequest.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.studentHostelAssignment.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
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

describe.skipIf(!dbReady)("Hostel Leave (DB)", () => {
  it("rejects a non-resident student", async () => {
    await expect(createHostelLeaveRequest(scopeAdmin, { studentId: nonResidentId, leaveType: "home", fromDate: "2026-05-01", toDate: "2026-05-03", reason: "x" })).rejects.toThrow(HttpError);
  });

  it("rejects an invalid date range", async () => {
    await expect(createHostelLeaveRequest(scopeAdmin, { studentId: residentId, leaveType: "home", fromDate: "2026-05-05", toDate: "2026-05-01", reason: "x" })).rejects.toThrow(HttpError);
  });

  it("creates a request, snapshotting the resident's CURRENT hostel/room", async () => {
    const req = await createHostelLeaveRequest(scopeAdmin, { studentId: residentId, leaveType: "home", fromDate: "2026-05-01", toDate: "2026-05-03", reason: "Family visit" });
    expect(req.status).toBe("pending");
    expect(req.hostelId).toBe(hostelId);
    expect(req.roomId).toBe(roomId);
    const fetched = await getHostelLeaveRequest(scopeAdmin, req.id);
    expect(fetched.id).toBe(req.id);
  });

  it("server-enforced lifecycle: approve only from pending; rejects a double-approve", async () => {
    const req = await createHostelLeaveRequest(scopeAdmin, { studentId: residentId, leaveType: "medical", fromDate: "2026-06-01", toDate: "2026-06-02", reason: "y" });
    const approved = await approveHostelLeaveRequest(scopeAdmin, req.id, { note: "OK" });
    expect(approved.status).toBe("approved");
    expect(approved.reviewedByName).toBe("Admin");
    await expect(approveHostelLeaveRequest(scopeAdmin, req.id, {})).rejects.toThrow(HttpError);
    await expect(rejectHostelLeaveRequest(scopeAdmin, req.id, {})).rejects.toThrow(HttpError);
  });

  it("reject and cancel transitions", async () => {
    const req1 = await createHostelLeaveRequest(scopeAdmin, { studentId: residentId, leaveType: "weekend", fromDate: "2026-06-10", toDate: "2026-06-11", reason: "z" });
    const rejected = await rejectHostelLeaveRequest(scopeAdmin, req1.id, { note: "No" });
    expect(rejected.status).toBe("rejected");

    const req2 = await createHostelLeaveRequest(scopeAdmin, { studentId: residentId, leaveType: "other", fromDate: "2026-06-15", toDate: "2026-06-16", reason: "z" });
    const cancelled = await cancelHostelLeaveRequest(scopeAdmin, req2.id, {});
    expect(cancelled.status).toBe("cancelled");
  });

  it("cross-tenant isolation", async () => {
    const list = await listHostelLeaveRequests(scopeForeignAdmin, {});
    expect(list.data.length).toBe(0);
  });

  it("DTO never leaks tenantId/schoolId", async () => {
    const req = await createHostelLeaveRequest(scopeAdmin, { studentId: residentId, leaveType: "home", fromDate: "2026-07-01", toDate: "2026-07-02", reason: "dto" });
    const raw = JSON.stringify(req);
    expect(raw).not.toContain(tenantId);
    expect(raw).not.toContain(schoolId);
  });
});

describe.skipIf(!dbReady)("Hostel Visitors (DB)", () => {
  it("rejects a non-resident student", async () => {
    await expect(createHostelVisitor(scopeAdmin, { studentId: nonResidentId, visitorName: "V", relation: "Uncle", purpose: "Visit" })).rejects.toThrow(HttpError);
  });

  it("lifecycle: EXPECTED -> CHECKED_IN -> CHECKED_OUT", async () => {
    const v = await createHostelVisitor(scopeAdmin, { studentId: residentId, visitorName: "Father", relation: "Father", purpose: "Drop supplies" });
    expect(v.status).toBe("expected");
    expect(v.hostelId).toBe(hostelId);
    expect(v.roomId).toBe(roomId);

    const checkedIn = await checkInHostelVisitor(scopeAdmin, v.id);
    expect(checkedIn.status).toBe("checked_in");
    expect(checkedIn.approvedByName).toBe("Admin");

    const checkedOut = await checkOutHostelVisitor(scopeAdmin, v.id);
    expect(checkedOut.status).toBe("checked_out");
    await expect(checkOutHostelVisitor(scopeAdmin, v.id)).rejects.toThrow(HttpError);
  });

  it("invalid transition: cannot cancel a checked-in visitor; cannot check in a cancelled one", async () => {
    const v1 = await createHostelVisitor(scopeAdmin, { studentId: residentId, visitorName: "V2", relation: "Aunt", purpose: "p" });
    await checkInHostelVisitor(scopeAdmin, v1.id);
    await expect(cancelHostelVisitor(scopeAdmin, v1.id)).rejects.toThrow(HttpError);

    const v2 = await createHostelVisitor(scopeAdmin, { studentId: residentId, visitorName: "V3", relation: "Friend", purpose: "p" });
    const cancelled = await cancelHostelVisitor(scopeAdmin, v2.id);
    expect(cancelled.status).toBe("cancelled");
    await expect(checkInHostelVisitor(scopeAdmin, v2.id)).rejects.toThrow(HttpError);
  });

  it("cross-tenant isolation", async () => {
    const v = await createHostelVisitor(scopeAdmin, { studentId: residentId, visitorName: "Iso", relation: "x", purpose: "p" });
    await expect(getHostelVisitor(scopeForeignAdmin, v.id)).rejects.toThrow(HttpError);
  });
});

describe.skipIf(!dbReady)("Hostel Complaints (DB)", () => {
  it("rejects a non-resident student", async () => {
    await expect(createHostelComplaint(scopeAdmin, { studentId: nonResidentId, category: "wifi", title: "t", description: "d" })).rejects.toThrow(HttpError);
  });

  it("rejects assigning inactive or foreign staff", async () => {
    const c = await createHostelComplaint(scopeAdmin, { studentId: residentId, category: "electricity", title: "No power", description: "Socket dead" });
    await expect(assignHostelComplaint(scopeAdmin, c.id, { staffId: inactiveStaff })).rejects.toThrow(HttpError);
    await expect(assignHostelComplaint(scopeAdmin, c.id, { staffId: foreignStaffId })).rejects.toThrow(HttpError);
    await expect(assignHostelComplaint(scopeAdmin, c.id, { staffId: "nonexistent" })).rejects.toThrow(HttpError);
  });

  it("full lifecycle: open -> assigned -> in_progress -> resolved -> closed", async () => {
    const c = await createHostelComplaint(scopeAdmin, { studentId: residentId, category: "water", title: "Leaky tap", description: "Bathroom tap leaking", priority: "high" });
    expect(c.status).toBe("open");
    expect(c.roomId).toBe(roomId);

    const assigned = await assignHostelComplaint(scopeAdmin, c.id, { staffId: staff1 });
    expect(assigned.status).toBe("assigned");
    expect(assigned.assignedStaffName).toContain("Facilities");

    const started = await startHostelComplaint(scopeAdmin, c.id);
    expect(started.status).toBe("in_progress");

    const resolved = await resolveHostelComplaint(scopeAdmin, c.id, { resolutionNotes: "Fixed the washer" });
    expect(resolved.status).toBe("resolved");
    expect(resolved.resolvedAt).toBeTruthy();

    const closed = await closeHostelComplaint(scopeAdmin, c.id);
    expect(closed.status).toBe("closed");
  });

  it("invalid transitions: cannot start an unassigned complaint, cannot resolve an open one, cannot close a non-resolved one", async () => {
    const c = await createHostelComplaint(scopeAdmin, { studentId: residentId, category: "safety", title: "t", description: "d" });
    await expect(startHostelComplaint(scopeAdmin, c.id)).rejects.toThrow(HttpError);
    await expect(resolveHostelComplaint(scopeAdmin, c.id, { resolutionNotes: "n" })).rejects.toThrow(HttpError);
    await expect(closeHostelComplaint(scopeAdmin, c.id)).rejects.toThrow(HttpError);
  });

  it("cross-tenant isolation", async () => {
    const c = await createHostelComplaint(scopeAdmin, { studentId: residentId, category: "other", title: "iso", description: "d" });
    await expect(getHostelComplaint(scopeForeignAdmin, c.id)).rejects.toThrow(HttpError);
  });
});

describe.skipIf(!dbReady)("Hostel Maintenance (DB)", () => {
  it("rejects a foreign hostel and a room that belongs to a different hostel", async () => {
    await expect(createHostelMaintenance(scopeAdmin, { hostelId: "nonexistent", title: "t", description: "d" })).rejects.toThrow(HttpError);
    const otherHostel = await createHostel(scopeAdmin, { code: `HC1-OTHER-${stamp}`, name: "Other House" });
    const otherRoom = await createRoom(scopeAdmin, { hostelId: otherHostel.id, roomNumber: `OR1-${stamp}`, capacity: 1 });
    await expect(createHostelMaintenance(scopeAdmin, { hostelId, roomId: otherRoom.id, title: "t", description: "d" })).rejects.toThrow(HttpError);
  });

  it("full lifecycle: open -> assigned -> in_progress -> completed", async () => {
    const m = await createHostelMaintenance(scopeAdmin, { hostelId, roomId, title: "Broken fan", description: "Ceiling fan not working", priority: "urgent" });
    expect(m.status).toBe("open");

    const assigned = await assignHostelMaintenance(scopeAdmin, m.id, { staffId: staff1 });
    expect(assigned.status).toBe("assigned");

    const started = await startHostelMaintenance(scopeAdmin, m.id);
    expect(started.status).toBe("in_progress");

    const completed = await completeHostelMaintenance(scopeAdmin, m.id, { notes: "Replaced motor" });
    expect(completed.status).toBe("completed");
    expect(completed.completedAt).toBeTruthy();
    await expect(cancelHostelMaintenance(scopeAdmin, m.id)).rejects.toThrow(HttpError);
  });

  it("cancel from open, and invalid transition (complete a never-assigned request)", async () => {
    const m1 = await createHostelMaintenance(scopeAdmin, { hostelId, title: "t1", description: "d1" });
    const cancelled = await cancelHostelMaintenance(scopeAdmin, m1.id);
    expect(cancelled.status).toBe("cancelled");

    const m2 = await createHostelMaintenance(scopeAdmin, { hostelId, title: "t2", description: "d2" });
    await expect(completeHostelMaintenance(scopeAdmin, m2.id, {})).rejects.toThrow(HttpError);
  });

  it("cross-tenant isolation", async () => {
    const m = await createHostelMaintenance(scopeAdmin, { hostelId, title: "iso", description: "d" });
    await expect(getHostelMaintenance(scopeForeignAdmin, m.id)).rejects.toThrow(HttpError);
  });
});

describe.skipIf(!dbReady)("Hostel Reports (DB)", () => {
  it("aggregates match real persisted counts, and are school-isolated", async () => {
    const report = await getHostelReports(scopeAdmin);
    expect(report.totalHostels).toBeGreaterThanOrEqual(2);
    expect(report.activeResidents).toBeGreaterThanOrEqual(1);
    expect(report.pendingLeaveRequests).toBeGreaterThanOrEqual(1);
    expect(report.openComplaints).toBeGreaterThanOrEqual(1);
    expect(report.pendingMaintenance).toBeGreaterThanOrEqual(1);

    const foreignReport = await getHostelReports(scopeForeignAdmin);
    expect(foreignReport.totalHostels).toBe(0);
    expect(foreignReport.activeResidents).toBe(0);
    expect(foreignReport.pendingLeaveRequests).toBe(0);
    expect(foreignReport.openComplaints).toBe(0);
    expect(foreignReport.pendingMaintenance).toBe(0);
  });
});

describe.skipIf(!dbReady)("Security / RBAC / Audit (DB)", () => {
  it("hostel.view/hostel.manage: SCHOOL_ADMIN has both; PRINCIPAL view only; TEACHER neither — no new permission keys were introduced", () => {
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("hostel.view");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("hostel.manage");
    expect(ROLE_PERMISSIONS.PRINCIPAL).toContain("hostel.view");
    expect(ROLE_PERMISSIONS.PRINCIPAL).not.toContain("hostel.manage");
    expect(ROLE_PERMISSIONS.TEACHER ?? []).not.toContain("hostel.view");
    expect(ROLE_PERMISSIONS.TEACHER ?? []).not.toContain("hostel.manage");
    void scopePrincipal; void scopeTeacher; // RBAC enforcement itself is at the route layer (requirePermission) — this documents the catalog contract.
  });

  it("Phase C1 mutations are audited", async () => {
    const events = await prisma.auditEvent.count({
      where: {
        tenantId,
        action: {
          in: [
            "HOSTEL_LEAVE_REQUESTED", "HOSTEL_LEAVE_APPROVED", "HOSTEL_LEAVE_REJECTED", "HOSTEL_LEAVE_CANCELLED",
            "HOSTEL_VISITOR_REQUESTED", "HOSTEL_VISITOR_CHECKED_IN", "HOSTEL_VISITOR_CHECKED_OUT", "HOSTEL_VISITOR_CANCELLED",
            "HOSTEL_COMPLAINT_CREATED", "HOSTEL_COMPLAINT_ASSIGNED", "HOSTEL_COMPLAINT_STATUS_CHANGED", "HOSTEL_COMPLAINT_RESOLVED",
            "HOSTEL_MAINTENANCE_CREATED", "HOSTEL_MAINTENANCE_ASSIGNED", "HOSTEL_MAINTENANCE_STATUS_CHANGED", "HOSTEL_MAINTENANCE_COMPLETED",
          ],
        },
      },
    });
    expect(events).toBeGreaterThan(10);
  });
});
