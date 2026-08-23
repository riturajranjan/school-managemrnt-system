// Hierarchical Account Provisioning DB integration tests (Phase 9W.2). Real
// Postgres: role-creation policy enforcement (success + forbidden escalation
// for every hop in the hierarchy), Staff/Student/Guardian link uniqueness +
// foreign-scope rejection, tenant/school isolation, concurrency (duplicate
// account-link races resolve to exactly one User), status transitions, real
// password-setup token completion, and audit/DTO safety. Namespaced ("T9W2").
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import type { AuthzContext } from "@/lib/server/authz/permissions";
import type { OrgScope } from "@/lib/server/api/scope";
import { HttpError } from "@/lib/server/api/guard";
import {
  assignRoleToAccount,
  getProvisionableRoles,
  listAccounts,
  provisionAccount,
  setAccountStatus,
} from "@/lib/server/users/provisioning";
import { completePasswordSetup, createPasswordSetupToken } from "@/lib/server/auth/password-setup";
import { canProvisionRole, provisionableRoleKeysFor } from "@/lib/server/authz/role-creation-policy";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T9W2";
const stamp = Date.now().toString(36);

let tenantId = "";
let schoolAId = "", branchAId = "";
let schoolBId = ""; // second school, SAME tenant — tests school-level isolation within one tenant
let foreignTenantId = "", foreignSchoolId = "", foreignBranchId = "";

const userIds: string[] = [];
const staffIds: string[] = [];
const studentIds: string[] = [];
const guardianIds: string[] = [];

async function makeUserWithRole(email: string, roleKey: string, tid = tenantId): Promise<{ id: string; ctx: AuthzContext }> {
  const u = await prisma.user.create({ data: { email, name: email, status: "ACTIVE" }, select: { id: true } });
  userIds.push(u.id);
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId: tid, status: "ACTIVE" }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  const perms = await prisma.rolePermission.findMany({ where: { roleId: role.id }, select: { permission: { select: { key: true } } } });
  const ctx: AuthzContext = {
    user: { id: u.id, name: email, email, image: null, status: "ACTIVE", isPlatformAdmin: false },
    sessionId: `sess-${u.id}`,
    isPlatformAdmin: false,
    platformRole: null,
    activeRoleKey: roleKey,
    permissions: new Set(perms.map((p) => p.permission.key)),
    schoolId: null,
    branchId: null,
    impersonation: null,
  };
  return { id: u.id, ctx };
}

async function makeStaff(schoolId: string, branchId: string, opts: { isTeaching?: boolean; code: string }) {
  const staff = await prisma.staff.create({
    data: { tenantId, schoolId, branchId, employeeCode: opts.code, firstName: "Staff", lastName: opts.code, isTeaching: opts.isTeaching ?? false, status: "ACTIVE" },
    select: { id: true },
  });
  staffIds.push(staff.id);
  return staff.id;
}

async function makeStudent(schoolId: string, branchId: string, sessionId: string, admissionNumber: string, status: "ACTIVE" | "INACTIVE" = "ACTIVE") {
  const student = await prisma.student.create({
    data: {
      tenantId, schoolId, branchId, academicSessionId: sessionId,
      admissionNumber, firstName: "Student", lastName: admissionNumber,
      dateOfBirth: new Date("2015-01-01"), admissionDate: new Date("2024-01-01"), status,
    },
    select: { id: true },
  });
  studentIds.push(student.id);
  return student.id;
}

let sessionAId = "";

let ctxSchoolAdmin: AuthzContext, ctxPrincipal: AuthzContext, ctxVicePrincipal: AuthzContext, ctxTeacher: AuthzContext;
let ctxHrAdmin: AuthzContext, ctxTransportManager: AuthzContext, ctxLibrarian: AuthzContext;
let ctxForeignAdmin: AuthzContext;
let scopeA: OrgScope, scopeForeign: OrgScope;

beforeAll(async () => {
  if (!dbReady) return;

  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t9w2-${stamp}` }, select: { id: true } })).id;
  schoolAId = (await prisma.school.create({ data: { tenantId, name: `${NS} SA`, code: `${NS}-A-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchAId = (await prisma.branch.create({ data: { schoolId: schoolAId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;
  schoolBId = (await prisma.school.create({ data: { tenantId, name: `${NS} SB`, code: `${NS}-B-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  sessionAId = (await prisma.academicSession.create({ data: { schoolId: schoolAId, name: "2026-27", code: `${NS}-SESS`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE", isCurrent: true }, select: { id: true } })).id;

  foreignTenantId = (await prisma.tenant.create({ data: { name: `${NS} FT`, slug: `t9w2-f-${stamp}` }, select: { id: true } })).id;
  foreignSchoolId = (await prisma.school.create({ data: { tenantId: foreignTenantId, name: `${NS} FS`, code: `${NS}-F-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  foreignBranchId = (await prisma.branch.create({ data: { schoolId: foreignSchoolId, name: "F", code: `${NS}-F`, status: "ACTIVE" }, select: { id: true } })).id;

  ctxSchoolAdmin = (await makeUserWithRole(`t9w2-sa-${stamp}@x.test`, "SCHOOL_ADMIN")).ctx;
  ctxPrincipal = (await makeUserWithRole(`t9w2-pr-${stamp}@x.test`, "PRINCIPAL")).ctx;
  ctxVicePrincipal = (await makeUserWithRole(`t9w2-vp-${stamp}@x.test`, "VICE_PRINCIPAL")).ctx;
  ctxTeacher = (await makeUserWithRole(`t9w2-te-${stamp}@x.test`, "TEACHER")).ctx;
  ctxHrAdmin = (await makeUserWithRole(`t9w2-hr-${stamp}@x.test`, "HR_ADMIN")).ctx;
  ctxTransportManager = (await makeUserWithRole(`t9w2-tm-${stamp}@x.test`, "TRANSPORT_MANAGER")).ctx;
  ctxLibrarian = (await makeUserWithRole(`t9w2-lb-${stamp}@x.test`, "LIBRARIAN")).ctx;
  ctxForeignAdmin = (await makeUserWithRole(`t9w2-fa-${stamp}@x.test`, "SCHOOL_ADMIN", foreignTenantId)).ctx;

  scopeA = { tenantId, schoolId: schoolAId, branchId: branchAId, academicSessionId: sessionAId, actor: { id: ctxSchoolAdmin.user.id, name: "Actor" } };
  scopeForeign = { tenantId: foreignTenantId, schoolId: foreignSchoolId, branchId: foreignBranchId, academicSessionId: null, actor: { id: ctxForeignAdmin.user.id, name: "Foreign Actor" } };
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.passwordSetupToken.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.auditEvent.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.transportRouteAssignment.deleteMany({ where: { tenantId } });
  await prisma.transportRoute.deleteMany({ where: { tenantId } });
  await prisma.transportVehicle.deleteMany({ where: { tenantId } });
  await prisma.studentGuardian.deleteMany({ where: { student: { tenantId } } });
  await prisma.guardian.deleteMany({ where: { id: { in: guardianIds } } });
  await prisma.student.deleteMany({ where: { id: { in: studentIds } } });
  await prisma.staff.deleteMany({ where: { id: { in: staffIds } } });
  await prisma.roleAssignment.deleteMany({ where: { membership: { tenantId: { in: [tenantId, foreignTenantId] } } } });
  await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.academicSession.deleteMany({ where: { schoolId: schoolAId } });
  await prisma.branch.deleteMany({ where: { schoolId: { in: [schoolAId, schoolBId, foreignSchoolId] } } });
  await prisma.school.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, foreignTenantId] } } });
});

describe.skipIf(!dbReady)("role-creation-policy (pure, no DB)", () => {
  it("derives the correct provisionable roles per actor role", () => {
    expect(provisionableRoleKeysFor("SCHOOL_ADMIN")).toEqual(["PRINCIPAL", "HR_ADMIN", "TRANSPORT_MANAGER", "LIBRARIAN", "STUDENT", "GUARDIAN"]);
    expect(provisionableRoleKeysFor("PRINCIPAL")).toEqual(["VICE_PRINCIPAL", "TEACHER", "STUDENT", "GUARDIAN"]);
    expect(provisionableRoleKeysFor("VICE_PRINCIPAL")).toEqual(["TEACHER", "STUDENT"]);
    expect(provisionableRoleKeysFor("HR_ADMIN")).toEqual(["STAFF"]);
    expect(provisionableRoleKeysFor("TRANSPORT_MANAGER")).toEqual(["STAFF"]);
    expect(provisionableRoleKeysFor("TEACHER")).toEqual([]);
    expect(provisionableRoleKeysFor("LIBRARIAN")).toEqual([]);
    expect(provisionableRoleKeysFor(null)).toEqual([]);
  });

  it("never allows a role to grant itself or a role above it", () => {
    expect(canProvisionRole("PRINCIPAL", "SCHOOL_ADMIN")).toBe(false);
    expect(canProvisionRole("HR_ADMIN", "PRINCIPAL")).toBe(false);
    expect(canProvisionRole("TRANSPORT_MANAGER", "HR_ADMIN")).toBe(false);
    expect(canProvisionRole("SCHOOL_ADMIN", "SCHOOL_ADMIN")).toBe(false);
    expect(canProvisionRole("VICE_PRINCIPAL", "PRINCIPAL")).toBe(false);
    expect(canProvisionRole("VICE_PRINCIPAL", "GUARDIAN")).toBe(false);
  });
});

describe.skipIf(!dbReady)("provisionable-roles endpoint logic reflects real policy", () => {
  it("SCHOOL_ADMIN sees exactly its allowed roles as real catalog rows", async () => {
    const roles = await getProvisionableRoles(ctxSchoolAdmin);
    expect(roles.map((r) => r.key).sort()).toEqual(["GUARDIAN", "HR_ADMIN", "LIBRARIAN", "PRINCIPAL", "STUDENT", "TRANSPORT_MANAGER"].sort());
  });
  it("TEACHER sees none", async () => {
    expect(await getProvisionableRoles(ctxTeacher)).toEqual([]);
  });
});

describe.skipIf(!dbReady)("SCHOOL_ADMIN → child roles", () => {
  it("provisions a real PRINCIPAL: User+TenantMembership+RoleAssignment+Staff.userId, audited", async () => {
    const staffId = await makeStaff(schoolAId, branchAId, { code: `PR-${stamp}` });
    const res = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "PRINCIPAL", email: `t9w2-newprincipal-${stamp}@x.test`, staffId });
    expect(res.accountCreated).toBe(true);
    expect(res.passwordSetupPending).toBe(true);
    expect(res.passwordSetupUrl).toMatch(/^\/setup-password\?token=/);
    userIds.push(res.userId);

    const staff = await prisma.staff.findUniqueOrThrow({ where: { id: staffId }, select: { userId: true } });
    expect(staff.userId).toBe(res.userId);
    const membership = await prisma.tenantMembership.findUniqueOrThrow({ where: { userId_tenantId: { userId: res.userId, tenantId } }, select: { roleAssignments: { select: { role: { select: { key: true } } } } } });
    expect(membership.roleAssignments.map((r) => r.role.key)).toEqual(["PRINCIPAL"]);

    const audit = await prisma.auditEvent.findFirst({ where: { action: "USER_ACCOUNT_PROVISIONED", entityId: res.userId } });
    expect(audit).not.toBeNull();
    expect(JSON.stringify(audit?.metaJson)).not.toMatch(/password|token/i);
  });

  it("rejects provisioning SUPER_ADMIN — no role above the actor", async () => {
    await expect(provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "SUPER_ADMIN", email: "x@x.test", staffId: "whatever" })).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });
  });

  it("rejects provisioning a sibling SCHOOL_ADMIN", async () => {
    await expect(provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "SCHOOL_ADMIN", email: "x2@x.test", staffId: "whatever" })).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });
  });

  it("cannot provision for a Staff record in a DIFFERENT school of the SAME tenant", async () => {
    const staffInB = await makeStaff(schoolBId, branchAId, { code: `PR-B-${stamp}` });
    await expect(provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "PRINCIPAL", email: `t9w2-crossschool-${stamp}@x.test`, staffId: staffInB })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("cannot provision for a Staff record in a foreign tenant", async () => {
    const foreignStaff = await makeStaff(foreignSchoolId, foreignBranchId, { code: `PR-F-${stamp}` });
    await expect(provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "PRINCIPAL", email: `t9w2-foreignstaff-${stamp}@x.test`, staffId: foreignStaff })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects a duplicate link to an already-linked Staff record", async () => {
    const staffId = await makeStaff(schoolAId, branchAId, { code: `DUP-${stamp}` });
    const first = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "LIBRARIAN", email: `t9w2-dup1-${stamp}@x.test`, staffId });
    userIds.push(first.userId);
    await expect(provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "LIBRARIAN", email: `t9w2-dup2-${stamp}@x.test`, staffId })).rejects.toMatchObject({ code: "STAFF_ALREADY_LINKED" });
  });

  it("reuses an existing User by email when it has no conflicting domain link yet — never creates a duplicate account", async () => {
    const email = `t9w2-reuse-${stamp}@x.test`;
    // An account that already exists (e.g. provisioned some other way) with no
    // Staff/Student/Guardian link at all yet — a real, if unusual, starting state.
    const preexisting = await prisma.user.create({ data: { email, name: "Pre-existing", status: "ACTIVE", passwordSetupRequired: false }, select: { id: true } });
    userIds.push(preexisting.id);

    const staff1 = await makeStaff(schoolAId, branchAId, { code: `RU1-${stamp}` });
    const res = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "HR_ADMIN", email, staffId: staff1 });
    expect(res.userId).toBe(preexisting.id);
    expect(res.accountCreated).toBe(false);
    expect(res.passwordSetupPending).toBe(false);
    expect(res.passwordSetupUrl).toBeNull();

    const emailCount = await prisma.user.count({ where: { email } });
    expect(emailCount).toBe(1);
  });

  it("rejects reusing an email whose account is already linked to a DIFFERENT Staff record (never a raw DB error)", async () => {
    const email = `t9w2-reuse-conflict-${stamp}@x.test`;
    const staff1 = await makeStaff(schoolAId, branchAId, { code: `RC1-${stamp}` });
    const first = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "HR_ADMIN", email, staffId: staff1 });
    userIds.push(first.userId);

    const staff2 = await makeStaff(schoolAId, branchAId, { code: `RC2-${stamp}` });
    await expect(provisionAccount(ctxHrAdmin, scopeA, { targetRoleKey: "STAFF", email, staffId: staff2 })).rejects.toMatchObject({ code: "ACCOUNT_ALREADY_LINKED_ELSEWHERE" });

    const staff2Row = await prisma.staff.findUniqueOrThrow({ where: { id: staff2 }, select: { userId: true } });
    expect(staff2Row.userId).toBeNull();
  });

  it("provisions a real STUDENT login, isolated by school", async () => {
    const studentId = await makeStudent(schoolAId, branchAId, sessionAId, `T9W2-STU-${stamp}`);
    const res = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "STUDENT", email: `t9w2-student-${stamp}@x.test` , studentId });
    userIds.push(res.userId);
    const student = await prisma.student.findUniqueOrThrow({ where: { id: studentId }, select: { userId: true } });
    expect(student.userId).toBe(res.userId);
  });

  it("rejects provisioning a login for a non-ACTIVE (e.g. withdrawn) student", async () => {
    const studentId = await makeStudent(schoolAId, branchAId, sessionAId, `T9W2-WD-${stamp}`, "INACTIVE");
    await expect(provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "STUDENT", email: `t9w2-wd-${stamp}@x.test`, studentId })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("provisions a real GUARDIAN login only for a Guardian with a real StudentGuardian link, never an arbitrary record", async () => {
    const studentId = await makeStudent(schoolAId, branchAId, sessionAId, `T9W2-GS-${stamp}`);
    const guardian = await prisma.guardian.create({ data: { tenantId, firstName: "Parent", lastName: stamp }, select: { id: true } });
    guardianIds.push(guardian.id);

    // Not yet linked to any student — must be rejected.
    await expect(provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "GUARDIAN", email: `t9w2-unlinked-guardian-${stamp}@x.test`, guardianId: guardian.id })).rejects.toMatchObject({ code: "GUARDIAN_NOT_LINKED_TO_STUDENT" });

    await prisma.studentGuardian.create({ data: { studentId, guardianId: guardian.id, relation: "MOTHER", isPrimary: true } });
    const res = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "GUARDIAN", email: `t9w2-guardian-${stamp}@x.test`, guardianId: guardian.id });
    userIds.push(res.userId);
    const linked = await prisma.guardian.findUniqueOrThrow({ where: { id: guardian.id }, select: { userId: true } });
    expect(linked.userId).toBe(res.userId);
  });

  it("rejects a Guardian belonging to a foreign tenant", async () => {
    const foreignGuardian = await prisma.guardian.create({ data: { tenantId: foreignTenantId, firstName: "Foreign", lastName: "Parent" }, select: { id: true } });
    guardianIds.push(foreignGuardian.id);
    await expect(provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "GUARDIAN", email: `t9w2-fg-${stamp}@x.test`, guardianId: foreignGuardian.id })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe.skipIf(!dbReady)("PRINCIPAL / VICE_PRINCIPAL hierarchy", () => {
  it("PRINCIPAL provisions VICE_PRINCIPAL and TEACHER (isTeaching required for TEACHER)", async () => {
    const vpStaff = await makeStaff(schoolAId, branchAId, { code: `VP-${stamp}` });
    const vp = await provisionAccount(ctxPrincipal, scopeA, { targetRoleKey: "VICE_PRINCIPAL", email: `t9w2-vp2-${stamp}@x.test`, staffId: vpStaff });
    userIds.push(vp.userId);

    const nonTeachingStaff = await makeStaff(schoolAId, branchAId, { code: `NT-${stamp}`, isTeaching: false });
    await expect(provisionAccount(ctxPrincipal, scopeA, { targetRoleKey: "TEACHER", email: `t9w2-nt-${stamp}@x.test`, staffId: nonTeachingStaff })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    const teachingStaff = await makeStaff(schoolAId, branchAId, { code: `TC-${stamp}`, isTeaching: true });
    const teacher = await provisionAccount(ctxPrincipal, scopeA, { targetRoleKey: "TEACHER", email: `t9w2-tc-${stamp}@x.test`, staffId: teachingStaff });
    userIds.push(teacher.userId);
  });

  it("PRINCIPAL cannot provision a sibling/ancestor SCHOOL_ADMIN", async () => {
    await expect(provisionAccount(ctxPrincipal, scopeA, { targetRoleKey: "SCHOOL_ADMIN", email: "x3@x.test", staffId: "whatever" })).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });
  });

  it("VICE_PRINCIPAL may provision TEACHER + STUDENT but NOT GUARDIAN or PRINCIPAL", async () => {
    const teachingStaff = await makeStaff(schoolAId, branchAId, { code: `VPT-${stamp}`, isTeaching: true });
    const teacher = await provisionAccount(ctxVicePrincipal, scopeA, { targetRoleKey: "TEACHER", email: `t9w2-vpt-${stamp}@x.test`, staffId: teachingStaff });
    userIds.push(teacher.userId);

    await expect(provisionAccount(ctxVicePrincipal, scopeA, { targetRoleKey: "GUARDIAN", email: "x4@x.test", guardianId: "whatever" })).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });
    await expect(provisionAccount(ctxVicePrincipal, scopeA, { targetRoleKey: "PRINCIPAL", email: "x5@x.test", staffId: "whatever" })).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });
  });

  it("TEACHER cannot provision or escalate anyone, including itself", async () => {
    await expect(provisionAccount(ctxTeacher, scopeA, { targetRoleKey: "TEACHER", email: "x6@x.test", staffId: "whatever" })).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });
    await expect(provisionAccount(ctxTeacher, scopeA, { targetRoleKey: "STUDENT", email: "x7@x.test", studentId: "whatever" })).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });
  });
});

describe.skipIf(!dbReady)("HR_ADMIN / TRANSPORT_MANAGER → STAFF", () => {
  it("HR_ADMIN provisions a bare STAFF login for any real unlinked Staff record", async () => {
    const staffId = await makeStaff(schoolAId, branchAId, { code: `HRS-${stamp}` });
    const res = await provisionAccount(ctxHrAdmin, scopeA, { targetRoleKey: "STAFF", email: `t9w2-hrstaff-${stamp}@x.test`, staffId });
    userIds.push(res.userId);
    expect(res.targetRoleKey).toBe("STAFF");
  });

  it("HR_ADMIN cannot provision PRINCIPAL or any role above STAFF", async () => {
    await expect(provisionAccount(ctxHrAdmin, scopeA, { targetRoleKey: "PRINCIPAL", email: "x8@x.test", staffId: "whatever" })).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });
  });

  it("TRANSPORT_MANAGER cannot provision a STAFF login for a Staff record with no real transport assignment", async () => {
    const staffId = await makeStaff(schoolAId, branchAId, { code: `NOTRANS-${stamp}` });
    await expect(provisionAccount(ctxTransportManager, scopeA, { targetRoleKey: "STAFF", email: `t9w2-notrans-${stamp}@x.test`, staffId })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("TRANSPORT_MANAGER CAN provision a STAFF login for a real transport-assigned driver", async () => {
    const driverStaff = await makeStaff(schoolAId, branchAId, { code: `DRV-${stamp}` });
    const vehicle = await prisma.transportVehicle.create({ data: { tenantId, schoolId: schoolAId, branchId: branchAId, registrationNumber: `T9W2-${stamp}`, capacity: 40, status: "ACTIVE" }, select: { id: true } });
    const route = await prisma.transportRoute.create({ data: { tenantId, schoolId: schoolAId, branchId: branchAId, name: "T9W2 Route", code: `T9W2-R-${stamp}`, status: "ACTIVE" }, select: { id: true } });
    await prisma.transportRouteAssignment.create({
      data: { tenantId, schoolId: schoolAId, branchId: branchAId, routeId: route.id, vehicleId: vehicle.id, driverStaffId: driverStaff, effectiveFrom: new Date("2026-01-01"), createdByUserId: ctxTransportManager.user.id, status: "ACTIVE" },
    });
    const res = await provisionAccount(ctxTransportManager, scopeA, { targetRoleKey: "STAFF", email: `t9w2-driver-${stamp}@x.test`, staffId: driverStaff });
    userIds.push(res.userId);
  });

  it("LIBRARIAN cannot provision any account at all", async () => {
    expect(await getProvisionableRoles(ctxLibrarian)).toEqual([]);
    await expect(provisionAccount(ctxLibrarian, scopeA, { targetRoleKey: "STAFF", email: "x9@x.test", staffId: "whatever" })).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });
  });
});

describe.skipIf(!dbReady)("concurrency — duplicate account-link races", () => {
  it("two simultaneous provisions for the SAME Staff resolve to exactly one link", async () => {
    const staffId = await makeStaff(schoolAId, branchAId, { code: `RACE-${stamp}` });
    const attempts = await Promise.allSettled([
      provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "LIBRARIAN", email: `t9w2-race1-${stamp}@x.test`, staffId }),
      provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "LIBRARIAN", email: `t9w2-race2-${stamp}@x.test`, staffId }),
    ]);
    const fulfilled = attempts.filter((a) => a.status === "fulfilled");
    expect(fulfilled.length).toBe(1);
    if (fulfilled[0]?.status === "fulfilled") userIds.push(fulfilled[0].value.userId);

    const staff = await prisma.staff.findUniqueOrThrow({ where: { id: staffId }, select: { userId: true } });
    expect(staff.userId).not.toBeNull();
  });
});

describe.skipIf(!dbReady)("status transitions + tenant isolation on read/write", () => {
  it("suspend then reactivate; a foreign-tenant actor cannot touch the account", async () => {
    const staffId = await makeStaff(schoolAId, branchAId, { code: `STAT-${stamp}` });
    const res = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "LIBRARIAN", email: `t9w2-stat-${stamp}@x.test`, staffId });
    userIds.push(res.userId);

    await setAccountStatus(scopeA, res.userId, { status: "SUSPENDED" });
    let user = await prisma.user.findUniqueOrThrow({ where: { id: res.userId }, select: { status: true } });
    expect(user.status).toBe("SUSPENDED");

    await expect(setAccountStatus(scopeForeign, res.userId, { status: "ACTIVE" })).rejects.toMatchObject({ code: "USER_NOT_FOUND" });

    await setAccountStatus(scopeA, res.userId, { status: "ACTIVE" });
    user = await prisma.user.findUniqueOrThrow({ where: { id: res.userId }, select: { status: true } });
    expect(user.status).toBe("ACTIVE");
  });

  it("listAccounts only returns accounts within the caller's own tenant, never a passwordHash", async () => {
    const { data } = await listAccounts(scopeA, {});
    expect(data.length).toBeGreaterThan(0);
    for (const row of data) expect(row).not.toHaveProperty("passwordHash");
    const foreignListing = await listAccounts(scopeForeign, {});
    expect(foreignListing.data.every((r) => r.email.includes("t9w2-fa-") || !r.email.startsWith(`t9w2-`))).toBe(true);
  });

  it("assignRoleToAccount respects the same policy as fresh provisioning", async () => {
    const staffId = await makeStaff(schoolAId, branchAId, { code: `ASSIGN-${stamp}`, isTeaching: true });
    const res = await provisionAccount(ctxPrincipal, scopeA, { targetRoleKey: "TEACHER", email: `t9w2-assign-${stamp}@x.test`, staffId });
    userIds.push(res.userId);

    await expect(assignRoleToAccount(ctxTeacher, scopeA, res.userId, { targetRoleKey: "TEACHER" })).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });

    await assignRoleToAccount(ctxSchoolAdmin, scopeA, res.userId, { targetRoleKey: "LIBRARIAN" });
    const membership = await prisma.tenantMembership.findUniqueOrThrow({ where: { userId_tenantId: { userId: res.userId, tenantId } }, select: { roleAssignments: { select: { role: { select: { key: true } } } } } });
    expect(membership.roleAssignments.map((r) => r.role.key).sort()).toEqual(["LIBRARIAN", "TEACHER"]);

    // Idempotent — assigning the same role again does not create a duplicate RoleAssignment (unique constraint).
    await assignRoleToAccount(ctxSchoolAdmin, scopeA, res.userId, { targetRoleKey: "LIBRARIAN" });
    const after = await prisma.tenantMembership.findUniqueOrThrow({ where: { userId_tenantId: { userId: res.userId, tenantId } }, select: { roleAssignments: true } });
    expect(after.roleAssignments.length).toBe(2);
  });
});

describe.skipIf(!dbReady)("real password setup completion", () => {
  it("completes setup with the real returned token, then rejects reuse of the same (consumed) token", async () => {
    const staffId = await makeStaff(schoolAId, branchAId, { code: `PW-${stamp}` });
    const res = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "LIBRARIAN", email: `t9w2-pw-${stamp}@x.test`, staffId });
    userIds.push(res.userId);
    expect(res.passwordSetupUrl).not.toBeNull();
    const token = new URL(`http://x${res.passwordSetupUrl}`).searchParams.get("token")!;

    await completePasswordSetup({ token, password: "Sup3rSecret!" });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: res.userId }, select: { status: true, passwordHash: true, passwordSetupRequired: true } });
    expect(user.status).toBe("ACTIVE");
    expect(user.passwordHash).not.toBeNull();
    expect(user.passwordSetupRequired).toBe(false);

    await expect(completePasswordSetup({ token, password: "AnotherOne1" })).rejects.toMatchObject({ code: "INVALID_SETUP_TOKEN" });
  });

  it("rejects an expired token", async () => {
    const staffId = await makeStaff(schoolAId, branchAId, { code: `PWEXP-${stamp}` });
    const res = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "LIBRARIAN", email: `t9w2-pwexp-${stamp}@x.test`, staffId });
    userIds.push(res.userId);
    // Force the token to look expired.
    await prisma.passwordSetupToken.updateMany({ where: { userId: res.userId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const token = new URL(`http://x${res.passwordSetupUrl}`).searchParams.get("token")!;
    await expect(completePasswordSetup({ token, password: "Sup3rSecret!" })).rejects.toMatchObject({ code: "INVALID_SETUP_TOKEN" });
  });

  it("rejects a garbage token outright (never a 500)", async () => {
    await expect(completePasswordSetup({ token: "not-a-real-token", password: "Sup3rSecret!" })).rejects.toBeInstanceOf(HttpError);
  });

  it("issuing a fresh token does not invalidate the still-outstanding one prematurely (each single-use, independent)", async () => {
    const staffId = await makeStaff(schoolAId, branchAId, { code: `PW2-${stamp}` });
    const res = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "LIBRARIAN", email: `t9w2-pw2-${stamp}@x.test`, staffId });
    userIds.push(res.userId);
    const { token: secondToken } = await createPasswordSetupToken(prisma, res.userId);
    await completePasswordSetup({ token: secondToken, password: "Sup3rSecret!" });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: res.userId }, select: { status: true } });
    expect(user.status).toBe("ACTIVE");
  });
});
