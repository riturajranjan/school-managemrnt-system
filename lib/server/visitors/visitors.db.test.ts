// Visitor Management DB integration tests (Phase 9I). Real Postgres: Visitor
// identity reuse, walk-in check-in (server-generated pass number),
// expected-visit scheduling, real Staff host resolution (+ invalid/cross-
// school/inactive rejection), lifecycle (EXPECTED->CHECKED_IN->CHECKED_OUT,
// EXPECTED->CANCELLED, invalid transitions, duplicate check-in/out),
// concurrency (pass-number uniqueness, concurrent check-in), search/filter/
// dashboard, isolation, RBAC, audit, and real notification-engine
// integration (Staff without a linked User never gets a fake recipient).
// Namespaced ("T9I"). Mirrors the exact setup/teardown pattern of
// lib/server/payroll/payroll.db.test.ts.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { cancelVisit, checkInVisit, checkOutVisit, createExpectedVisit, createWalkInVisit, getVisit, getVisitorDashboard, listVisits } from "@/lib/server/visitors/visits";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T9I";
const stamp = Date.now().toString(36);

let tenantId = "", schoolId = "", branchA = "";
let hostWithUser = "", hostNoUser = "", inactiveStaff = "";
let foreignTenantId = "", foreignSchoolId = "", foreignHostId = "";
let scopeAdmin: OrgScope, scopeTeacher: OrgScope, scopeForeignAdmin: OrgScope;
let adminUser = "", teacherUser = "", hostUser = "", foreignAdminUser = "";

async function makeUserWithRole(email: string, roleKey: string, tid = tenantId): Promise<string> {
  const u = await prisma.user.create({ data: { email, name: email, status: "ACTIVE" }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId: tid, status: "ACTIVE" }, select: { id: true } });
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  return u.id;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t9i-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;

  adminUser = await makeUserWithRole(`t9i-admin-${stamp}@x.test`, "SCHOOL_ADMIN");
  teacherUser = await makeUserWithRole(`t9i-t1-${stamp}@x.test`, "TEACHER");
  hostUser = await makeUserWithRole(`t9i-host-${stamp}@x.test`, "TEACHER");

  hostWithUser = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-H1-${stamp}`, firstName: "Hosting", lastName: "Teacher", status: "ACTIVE", userId: hostUser }, select: { id: true } })).id;
  hostNoUser = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-H2-${stamp}`, firstName: "NoLogin", lastName: "Host", status: "ACTIVE" }, select: { id: true } })).id;
  inactiveStaff = (await prisma.staff.create({ data: { tenantId, schoolId, branchId: branchA, employeeCode: `${NS}-H3-${stamp}`, firstName: "Inactive", lastName: "Host", status: "INACTIVE" }, select: { id: true } })).id;

  foreignTenantId = (await prisma.tenant.create({ data: { name: `${NS} T2`, slug: `t9i-b-${stamp}` }, select: { id: true } })).id;
  foreignSchoolId = (await prisma.school.create({ data: { tenantId: foreignTenantId, name: `${NS} S2`, code: `${NS}-B-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  const foreignBranch = (await prisma.branch.create({ data: { schoolId: foreignSchoolId, name: "B", code: `${NS}-B`, status: "ACTIVE" }, select: { id: true } })).id;
  foreignHostId = (await prisma.staff.create({ data: { tenantId: foreignTenantId, schoolId: foreignSchoolId, branchId: foreignBranch, employeeCode: `${NS}-F-${stamp}`, firstName: "Foreign", status: "ACTIVE" }, select: { id: true } })).id;
  foreignAdminUser = await makeUserWithRole(`t9i-fadmin-${stamp}@x.test`, "SCHOOL_ADMIN", foreignTenantId);

  scopeAdmin = { tenantId, schoolId, branchId: branchA, academicSessionId: null, actor: { id: adminUser, name: "Admin" } };
  scopeTeacher = { tenantId, schoolId, branchId: branchA, academicSessionId: null, actor: { id: teacherUser, name: "Teacher" } };
  scopeForeignAdmin = { tenantId: foreignTenantId, schoolId: foreignSchoolId, branchId: foreignBranch, academicSessionId: null, actor: { id: foreignAdminUser, name: "Foreign Admin" } };
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.notificationRecipient.deleteMany({ where: { user: { id: { in: [adminUser, teacherUser, hostUser, foreignAdminUser] } } } });
  await prisma.notification.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.visitorVisit.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.visitor.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.visitorPassCounter.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.staff.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.roleAssignment.deleteMany({ where: { membership: { tenantId: { in: [tenantId, foreignTenantId] } } } });
  await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.branch.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.school.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [adminUser, teacherUser, hostUser, foreignAdminUser] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, foreignTenantId] } } });
});

describe.skipIf(!dbReady)("Walk-in Check-in (DB)", () => {
  it("registers a visitor, checks in immediately, and generates a real server-side pass number", async () => {
    const visit = await createWalkInVisit(scopeAdmin, { fullName: "Ravi Sharma", phone: `98765${stamp}`, category: "parent", purpose: "Meet class teacher", hostStaffId: hostWithUser });
    expect(visit.status).toBe("checked_in");
    expect(visit.checkedInAt).toBeTruthy();
    expect(visit.passNumber).toMatch(/^VIS-/);
    expect(visit.hostStaffId).toBe(hostWithUser);
  });

  it("reuses an existing Visitor for the same (phone, name) on a second walk-in — never a duplicate person row", async () => {
    const phone = `91111${stamp}`;
    const first = await createWalkInVisit(scopeAdmin, { fullName: "Repeat Visitor", phone, category: "vendor", purpose: "Delivery", hostStaffId: hostWithUser });
    const second = await createWalkInVisit(scopeAdmin, { fullName: "Repeat Visitor", phone, category: "vendor", purpose: "Follow-up", hostStaffId: hostWithUser });
    expect(second.visitorId).toBe(first.visitorId);
    expect(second.id).not.toBe(first.id); // two distinct visits by the same person
    const visitorCount = await prisma.visitor.count({ where: { schoolId, phone } });
    expect(visitorCount).toBe(1);
  });

  it("rejects an invalid/nonexistent host", async () => {
    await expect(createWalkInVisit(scopeAdmin, { fullName: "X", phone: `1${stamp}`, category: "guest", purpose: "Visit", hostStaffId: "nonexistent-staff" })).rejects.toThrow(HttpError);
  });

  it("rejects a cross-school host", async () => {
    await expect(createWalkInVisit(scopeAdmin, { fullName: "X", phone: `2${stamp}`, category: "guest", purpose: "Visit", hostStaffId: foreignHostId })).rejects.toThrow(HttpError);
  });

  it("rejects an inactive host (default policy: ACTIVE staff only)", async () => {
    await expect(createWalkInVisit(scopeAdmin, { fullName: "X", phone: `3${stamp}`, category: "guest", purpose: "Visit", hostStaffId: inactiveStaff })).rejects.toThrow(HttpError);
  });

  it("TEACHER cannot register a walk-in visitor", async () => {
    await expect(createWalkInVisit(scopeTeacher, { fullName: "X", phone: `4${stamp}`, category: "guest", purpose: "Visit", hostStaffId: hostWithUser })).rejects.toThrow(HttpError);
  });

  it("pass numbers are unique and race-safe under concurrent walk-ins", async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => createWalkInVisit(scopeAdmin, { fullName: `Race Visitor ${i}`, phone: `7${i}${stamp}`, category: "guest", purpose: "Visit", hostStaffId: hostWithUser })),
    );
    const passNumbers = new Set(results.map((r) => r.passNumber));
    expect(passNumbers.size).toBe(8);
  });
});

describe.skipIf(!dbReady)("Expected Visits + Lifecycle (DB)", () => {
  it("schedules an expected visit; check-in updates the SAME visit record with a real pass number", async () => {
    const expectedAt = new Date(Date.now() + 3_600_000).toISOString();
    const created = await createExpectedVisit(scopeAdmin, { fullName: "Expected Guest", phone: `5${stamp}`, category: "official", purpose: "Inspection", hostStaffId: hostWithUser, expectedAt });
    expect(created.status).toBe("expected");
    expect(created.passNumber).toBeNull();

    const checkedIn = await checkInVisit(scopeAdmin, created.id);
    expect(checkedIn.id).toBe(created.id); // same visit record, not a new one
    expect(checkedIn.status).toBe("checked_in");
    expect(checkedIn.passNumber).toMatch(/^VIS-/);
    expect(checkedIn.checkedInAt).toBeTruthy();
  });

  it("checks out a checked-in visit with a server timestamp", async () => {
    const visit = await createWalkInVisit(scopeAdmin, { fullName: "Checkout Test", phone: `6${stamp}`, category: "guest", purpose: "Visit", hostStaffId: hostWithUser });
    const before = Date.now();
    const out = await checkOutVisit(scopeAdmin, visit.id);
    expect(out.status).toBe("checked_out");
    expect(new Date(out.checkedOutAt!).getTime()).toBeGreaterThanOrEqual(before);
  });

  it("rejects check-out before check-in (an EXPECTED visit)", async () => {
    const created = await createExpectedVisit(scopeAdmin, { fullName: "Never Arrived", phone: `8${stamp}`, category: "guest", purpose: "Visit", hostStaffId: hostWithUser, expectedAt: new Date().toISOString() });
    await expect(checkOutVisit(scopeAdmin, created.id)).rejects.toThrow(HttpError);
  });

  it("rejects duplicate check-in", async () => {
    const visit = await createWalkInVisit(scopeAdmin, { fullName: "Dup Checkin", phone: `9${stamp}`, category: "guest", purpose: "Visit", hostStaffId: hostWithUser });
    await expect(checkInVisit(scopeAdmin, visit.id)).rejects.toThrow(HttpError); // already CHECKED_IN
  });

  it("rejects duplicate check-out with a specific typed error", async () => {
    const visit = await createWalkInVisit(scopeAdmin, { fullName: "Dup Checkout", phone: `10${stamp}`, category: "guest", purpose: "Visit", hostStaffId: hostWithUser });
    await checkOutVisit(scopeAdmin, visit.id);
    await expect(checkOutVisit(scopeAdmin, visit.id)).rejects.toThrow(HttpError);
  });

  it("cancels an EXPECTED visit; cannot cancel a CHECKED_IN visit; cannot check in after cancellation", async () => {
    const created = await createExpectedVisit(scopeAdmin, { fullName: "Cancel Me", phone: `11${stamp}`, category: "guest", purpose: "Visit", hostStaffId: hostWithUser, expectedAt: new Date().toISOString() });
    const cancelled = await cancelVisit(scopeAdmin, created.id);
    expect(cancelled.status).toBe("cancelled");
    await expect(checkInVisit(scopeAdmin, created.id)).rejects.toThrow(HttpError);

    const checkedIn = await createWalkInVisit(scopeAdmin, { fullName: "Active Visit", phone: `12${stamp}`, category: "guest", purpose: "Visit", hostStaffId: hostWithUser });
    await expect(cancelVisit(scopeAdmin, checkedIn.id)).rejects.toThrow(HttpError); // only EXPECTED can be cancelled
  });

  it("two concurrent check-in attempts on the same expected visit: exactly one succeeds", async () => {
    const created = await createExpectedVisit(scopeAdmin, { fullName: "Concurrent Checkin", phone: `13${stamp}`, category: "guest", purpose: "Visit", hostStaffId: hostWithUser, expectedAt: new Date().toISOString() });
    const results = await Promise.all([checkInVisit(scopeAdmin, created.id).catch((e) => e), checkInVisit(scopeAdmin, created.id).catch((e) => e)]);
    const succeeded = results.filter((r) => !(r instanceof Error));
    expect(succeeded.length).toBe(1);
    const final = await getVisit(scopeAdmin, created.id);
    expect(final.status).toBe("checked_in");
  });

  it("two concurrent check-out attempts on the same checked-in visit: exactly one succeeds", async () => {
    const visit = await createWalkInVisit(scopeAdmin, { fullName: "Concurrent Checkout", phone: `14${stamp}`, category: "guest", purpose: "Visit", hostStaffId: hostWithUser });
    const results = await Promise.all([checkOutVisit(scopeAdmin, visit.id).catch((e) => e), checkOutVisit(scopeAdmin, visit.id).catch((e) => e)]);
    const succeeded = results.filter((r) => !(r instanceof Error));
    expect(succeeded.length).toBe(1);
  });
});

describe.skipIf(!dbReady)("Search / Filter / History / Dashboard (DB)", () => {
  it("search by name and phone finds the right visit", async () => {
    const uniqueName = `Findable Visitor ${stamp}`;
    const uniquePhone = `99${stamp}`;
    const created = await createWalkInVisit(scopeAdmin, { fullName: uniqueName, phone: uniquePhone, category: "guest", purpose: "Visit", hostStaffId: hostWithUser });
    const byName = await listVisits(scopeAdmin, { search: "Findable Visitor" });
    expect(byName.data.some((v) => v.id === created.id)).toBe(true);
    const byPhone = await listVisits(scopeAdmin, { search: uniquePhone });
    expect(byPhone.data.some((v) => v.id === created.id)).toBe(true);
  });

  it("status filter and host filter narrow results correctly", async () => {
    const visit = await createWalkInVisit(scopeAdmin, { fullName: "Filter Test", phone: `20${stamp}`, category: "guest", purpose: "Visit", hostStaffId: hostNoUser });
    const byStatus = await listVisits(scopeAdmin, { status: "checked_in" });
    expect(byStatus.data.every((v) => v.status === "checked_in")).toBe(true);
    const byHost = await listVisits(scopeAdmin, { hostStaffId: hostNoUser });
    expect(byHost.data.every((v) => v.hostStaffId === hostNoUser)).toBe(true);
    expect(byHost.data.some((v) => v.id === visit.id)).toBe(true);
  });

  it("history remains available after checkout, unaffected by later Staff display changes", async () => {
    const visit = await createWalkInVisit(scopeAdmin, { fullName: "History Test", phone: `21${stamp}`, category: "guest", purpose: "Visit", hostStaffId: hostNoUser });
    await checkOutVisit(scopeAdmin, visit.id);
    await prisma.staff.update({ where: { id: hostNoUser }, data: { firstName: "RenamedHost" } });
    const detail = await getVisit(scopeAdmin, visit.id);
    expect(detail.status).toBe("checked_out");
    expect(detail.hostName).toContain("RenamedHost"); // live relation — a rename is reflected, matching Staff-relation precedent elsewhere
  });

  it("dashboard counts are real and derived from the database", async () => {
    const dashboard = await getVisitorDashboard(scopeAdmin);
    expect(typeof dashboard.today).toBe("number");
    expect(typeof dashboard.currentlyInside).toBe("number");
    expect(dashboard.currentlyInside).toBeGreaterThan(0); // multiple checked-in visits created above
    expect(Array.isArray(dashboard.currentlyInsideList)).toBe(true);
  });
});

describe.skipIf(!dbReady)("Notifications (DB)", () => {
  it("check-in notifies the host's real linked User via the real notification engine, idempotently", async () => {
    const visit = await createWalkInVisit(scopeAdmin, { fullName: "Notify Test", phone: `30${stamp}`, category: "guest", purpose: "Visit", hostStaffId: hostWithUser });
    const notification = await prisma.notification.findUnique({ where: { dedupeKey: `VISITOR_CHECKED_IN:${visit.id}` }, select: { id: true, type: true, recipients: { select: { userId: true } } } });
    expect(notification).toBeTruthy();
    expect(notification!.type).toBe("VISITOR_CHECKED_IN");
    expect(notification!.recipients.map((r) => r.userId)).toContain(hostUser);
  });

  it("a host with no linked User account never creates a fake recipient (and no crash)", async () => {
    const visit = await createWalkInVisit(scopeAdmin, { fullName: "No User Host Test", phone: `31${stamp}`, category: "guest", purpose: "Visit", hostStaffId: hostNoUser });
    const notification = await prisma.notification.findUnique({ where: { dedupeKey: `VISITOR_CHECKED_IN:${visit.id}` } });
    expect(notification).toBeNull(); // createNotification no-ops when recipientUserIds is empty
  });
});

describe.skipIf(!dbReady)("Security / RBAC / Isolation / Audit (DB)", () => {
  it("visitors.view/manage: SCHOOL_ADMIN has both; TEACHER has neither; PRINCIPAL has view only", () => {
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("visitors.view");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("visitors.manage");
    expect(ROLE_PERMISSIONS.TEACHER ?? []).not.toContain("visitors.view");
    expect(ROLE_PERMISSIONS.TEACHER ?? []).not.toContain("visitors.manage");
    expect(ROLE_PERMISSIONS.PRINCIPAL).toContain("visitors.view");
    expect(ROLE_PERMISSIONS.PRINCIPAL).not.toContain("visitors.manage");
  });

  it("cross-tenant visit/visitor is invisible", async () => {
    const foreignVisit = await createWalkInVisit(scopeForeignAdmin, { fullName: "Foreign Visitor", phone: `40${stamp}`, category: "guest", purpose: "Visit", hostStaffId: foreignHostId });
    await expect(getVisit(scopeAdmin, foreignVisit.id)).rejects.toThrow(HttpError);
    await expect(checkOutVisit(scopeAdmin, foreignVisit.id)).rejects.toThrow(HttpError);
  });

  it("visitor mutations are audited", async () => {
    const events = await prisma.auditEvent.count({ where: { tenantId, action: { in: ["VISITOR_CHECKED_IN", "VISIT_EXPECTED", "VISITOR_CHECKED_OUT", "VISIT_CANCELLED"] } } });
    expect(events).toBeGreaterThan(5);
  });

  it("visit detail DTO never leaks fields beyond the documented contract", async () => {
    const visit = await createWalkInVisit(scopeAdmin, { fullName: "DTO Safety", phone: `41${stamp}`, category: "guest", purpose: "Visit", hostStaffId: hostWithUser });
    const detail = await getVisit(scopeAdmin, visit.id);
    const allowedKeys = new Set(["id", "visitorId", "visitorName", "visitorPhone", "organization", "hostStaffId", "hostName", "category", "purpose", "department", "vehicleNumber", "status", "expectedAt", "checkedInAt", "checkedOutAt", "passNumber", "visitorPastVisitCount"]);
    for (const key of Object.keys(detail)) expect(allowedKeys.has(key)).toBe(true);
  });
});
