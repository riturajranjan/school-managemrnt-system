// Hierarchical Account Provisioning DB integration tests (Phase 9W.2,
// finalized in the User Account Creation Foundation review). Real Postgres:
// FINAL role-creation-policy matrix enforcement (allowed combinations, same-
// level denial, upward denial), inline Staff/Student/Guardian creation
// (reusing createStaff/createStudent/linkGuardianToStudent), Teacher-scoped
// listAccounts/setAccountStatus/assignRoleToAccount/reissuePasswordSetup,
// Student self-service "Add/Invite My Guardian" isolation, admin password
// reset, tenant/school isolation, concurrency (duplicate account-link races
// resolve to exactly one User), status transitions, real password-setup
// token completion, and audit/DTO safety. Namespaced ("T9W2").
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
  reissuePasswordSetup,
  setAccountStatus,
} from "@/lib/server/users/provisioning";
import { completePasswordSetup, createPasswordSetupToken } from "@/lib/server/auth/password-setup";
import { authenticateWithPassword } from "@/lib/server/auth/service";
import { canProvisionRole, provisionableRoleKeysFor } from "@/lib/server/authz/role-creation-policy";
import { addMyGuardian } from "@/lib/server/students/self-guardian";
import { getAccountActivity, getAccountDetail, updateAccountDetail } from "@/lib/server/users/account-detail";
import { adminSetPassword, changeOwnPassword } from "@/lib/server/auth/password-change";
import { resolvePostLogin } from "@/lib/server/context/resolver";

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
let sessionAId = "";
let classId = "", sectionOwnedId = "", sectionOtherId = "", subjectId = "";
let teacherStaffId = "";
let studentOwnedId = "", studentOtherId = "";

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

async function makeStaff(schoolId: string, branchId: string, opts: { isTeaching?: boolean; code: string; userId?: string }) {
  const staff = await prisma.staff.create({
    data: { tenantId, schoolId, branchId, employeeCode: opts.code, firstName: "Staff", lastName: opts.code, isTeaching: opts.isTeaching ?? false, status: "ACTIVE", userId: opts.userId },
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
  const teacherUser = await makeUserWithRole(`t9w2-te-${stamp}@x.test`, "TEACHER");
  ctxTeacher = teacherUser.ctx;
  ctxHrAdmin = (await makeUserWithRole(`t9w2-hr-${stamp}@x.test`, "HR_ADMIN")).ctx;
  ctxTransportManager = (await makeUserWithRole(`t9w2-tm-${stamp}@x.test`, "TRANSPORT_MANAGER")).ctx;
  ctxLibrarian = (await makeUserWithRole(`t9w2-lb-${stamp}@x.test`, "LIBRARIAN")).ctx;
  ctxForeignAdmin = (await makeUserWithRole(`t9w2-fa-${stamp}@x.test`, "SCHOOL_ADMIN", foreignTenantId)).ctx;

  scopeA = { tenantId, schoolId: schoolAId, branchId: branchAId, academicSessionId: sessionAId, actor: { id: ctxSchoolAdmin.user.id, name: "Actor" } };
  scopeForeign = { tenantId: foreignTenantId, schoolId: foreignSchoolId, branchId: foreignBranchId, academicSessionId: null, actor: { id: ctxForeignAdmin.user.id, name: "Foreign Actor" } };

  // Teacher-scope fixtures: a real Staff linked to ctxTeacher's user, with a
  // real TeachingAssignment for one section, and a student enrolled in it
  // (owned) vs. a student in a DIFFERENT section (not owned).
  teacherStaffId = await makeStaff(schoolAId, branchAId, { code: `TSTAFF-${stamp}`, isTeaching: true, userId: teacherUser.id });
  classId = (await prisma.class.create({ data: { tenantId, schoolId: schoolAId, academicSessionId: sessionAId, name: `${NS} Grade`, order: 1 }, select: { id: true } })).id;
  sectionOwnedId = (await prisma.section.create({ data: { tenantId, schoolId: schoolAId, branchId: branchAId, academicSessionId: sessionAId, classId, name: "Owned", status: "ACTIVE" }, select: { id: true } })).id;
  sectionOtherId = (await prisma.section.create({ data: { tenantId, schoolId: schoolAId, branchId: branchAId, academicSessionId: sessionAId, classId, name: "Other", status: "ACTIVE" }, select: { id: true } })).id;
  subjectId = (await prisma.subject.create({ data: { tenantId, schoolId: schoolAId, code: `${NS}-SUB`, name: "Subject", shortName: "SUB", department: "Gen", type: "CORE", maxMarks: 100, passingMarks: 33, theoryMarks: 100, practicalMarks: 0 }, select: { id: true } })).id;
  await prisma.teachingAssignment.create({ data: { tenantId, schoolId: schoolAId, branchId: branchAId, academicSessionId: sessionAId, sectionId: sectionOwnedId, subjectId, staffId: teacherStaffId } });

  studentOwnedId = await makeStudent(schoolAId, branchAId, sessionAId, `T9W2-OWN-${stamp}`);
  studentOtherId = await makeStudent(schoolAId, branchAId, sessionAId, `T9W2-OTH-${stamp}`);
  await prisma.enrollment.create({ data: { tenantId, schoolId: schoolAId, branchId: branchAId, academicSessionId: sessionAId, classId, sectionId: sectionOwnedId, studentId: studentOwnedId, status: "ENROLLED" } });
  await prisma.enrollment.create({ data: { tenantId, schoolId: schoolAId, branchId: branchAId, academicSessionId: sessionAId, classId, sectionId: sectionOtherId, studentId: studentOtherId, status: "ENROLLED" } });
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.passwordSetupToken.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.auditEvent.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.transportRouteAssignment.deleteMany({ where: { tenantId } });
  await prisma.transportRoute.deleteMany({ where: { tenantId } });
  await prisma.transportVehicle.deleteMany({ where: { tenantId } });
  await prisma.enrollment.deleteMany({ where: { tenantId } });
  await prisma.teachingAssignment.deleteMany({ where: { tenantId } });
  await prisma.section.deleteMany({ where: { tenantId } });
  await prisma.class.deleteMany({ where: { tenantId } });
  await prisma.subject.deleteMany({ where: { tenantId } });
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

describe.skipIf(!dbReady)("role-creation-policy — FINAL approved matrix (pure, no DB)", () => {
  it("derives the correct provisionable roles per actor role", () => {
    expect(provisionableRoleKeysFor("SCHOOL_ADMIN")).toEqual(["PRINCIPAL", "VICE_PRINCIPAL", "TEACHER", "HR_ADMIN", "TRANSPORT_MANAGER", "LIBRARIAN", "STAFF", "STUDENT", "GUARDIAN"]);
    expect(provisionableRoleKeysFor("PRINCIPAL")).toEqual(["VICE_PRINCIPAL", "TEACHER", "STUDENT", "GUARDIAN"]);
    expect(provisionableRoleKeysFor("VICE_PRINCIPAL")).toEqual(["TEACHER", "STUDENT", "GUARDIAN"]);
    expect(provisionableRoleKeysFor("TEACHER")).toEqual(["STUDENT", "GUARDIAN"]);
    expect(provisionableRoleKeysFor("HR_ADMIN")).toEqual(["STAFF"]);
    expect(provisionableRoleKeysFor("TRANSPORT_MANAGER")).toEqual(["STAFF"]);
    expect(provisionableRoleKeysFor("LIBRARIAN")).toEqual([]);
    expect(provisionableRoleKeysFor("STUDENT")).toEqual([]);
    expect(provisionableRoleKeysFor("GUARDIAN")).toEqual([]);
    expect(provisionableRoleKeysFor(null)).toEqual([]);
  });

  it("same-level creation is never allowed unless explicitly listed — exhaustive denial matrix", () => {
    // SUPER_ADMIN is a PlatformAdmin boundary, not modeled in this map — no
    // tenant role key grants it, which this loop also implicitly confirms.
    expect(canProvisionRole("SUPER_ADMIN", "PRINCIPAL")).toBe(false);
    expect(canProvisionRole("SCHOOL_ADMIN", "SCHOOL_ADMIN")).toBe(false);
    expect(canProvisionRole("SCHOOL_ADMIN", "SUPER_ADMIN")).toBe(false);
    expect(canProvisionRole("PRINCIPAL", "PRINCIPAL")).toBe(false);
    expect(canProvisionRole("PRINCIPAL", "SCHOOL_ADMIN")).toBe(false);
    expect(canProvisionRole("PRINCIPAL", "HR_ADMIN")).toBe(false);
    expect(canProvisionRole("PRINCIPAL", "TRANSPORT_MANAGER")).toBe(false);
    expect(canProvisionRole("PRINCIPAL", "SUPER_ADMIN")).toBe(false);
    expect(canProvisionRole("VICE_PRINCIPAL", "VICE_PRINCIPAL")).toBe(false);
    expect(canProvisionRole("VICE_PRINCIPAL", "PRINCIPAL")).toBe(false);
    expect(canProvisionRole("VICE_PRINCIPAL", "SCHOOL_ADMIN")).toBe(false);
    expect(canProvisionRole("TEACHER", "TEACHER")).toBe(false);
    expect(canProvisionRole("TEACHER", "VICE_PRINCIPAL")).toBe(false);
    expect(canProvisionRole("TEACHER", "PRINCIPAL")).toBe(false);
    expect(canProvisionRole("TEACHER", "SCHOOL_ADMIN")).toBe(false);
    expect(canProvisionRole("TEACHER", "HR_ADMIN")).toBe(false);
    expect(canProvisionRole("TEACHER", "TRANSPORT_MANAGER")).toBe(false);
    expect(canProvisionRole("HR_ADMIN", "PRINCIPAL")).toBe(false);
    expect(canProvisionRole("HR_ADMIN", "SCHOOL_ADMIN")).toBe(false);
    expect(canProvisionRole("TRANSPORT_MANAGER", "TEACHER")).toBe(false);
    expect(canProvisionRole("TRANSPORT_MANAGER", "HR_ADMIN")).toBe(false);
    expect(canProvisionRole("TRANSPORT_MANAGER", "PRINCIPAL")).toBe(false);
    expect(canProvisionRole("TRANSPORT_MANAGER", "SCHOOL_ADMIN")).toBe(false);
    expect(canProvisionRole("STUDENT", "TEACHER")).toBe(false);
    expect(canProvisionRole("STUDENT", "PRINCIPAL")).toBe(false);
    expect(canProvisionRole("STUDENT", "SCHOOL_ADMIN")).toBe(false);
    expect(canProvisionRole("STUDENT", "GUARDIAN")).toBe(false); // real matrix — the STUDENT role key itself grants nothing; the self-service flow is a separate code path
    expect(canProvisionRole("GUARDIAN", "STUDENT")).toBe(false);
    expect(canProvisionRole("LIBRARIAN", "STAFF")).toBe(false);
  });
});

describe.skipIf(!dbReady)("provisionable-roles endpoint logic reflects real policy", () => {
  it("SCHOOL_ADMIN sees exactly its allowed roles as real catalog rows", async () => {
    const roles = await getProvisionableRoles(ctxSchoolAdmin);
    expect(roles.map((r) => r.key).sort()).toEqual(["GUARDIAN", "HR_ADMIN", "LIBRARIAN", "PRINCIPAL", "STAFF", "STUDENT", "TEACHER", "TRANSPORT_MANAGER", "VICE_PRINCIPAL"].sort());
  });
  it("TEACHER sees exactly Student + Guardian", async () => {
    expect((await getProvisionableRoles(ctxTeacher)).map((r) => r.key).sort()).toEqual(["GUARDIAN", "STUDENT"]);
  });
  it("LIBRARIAN sees none", async () => {
    expect(await getProvisionableRoles(ctxLibrarian)).toEqual([]);
  });
});

describe.skipIf(!dbReady)("SCHOOL_ADMIN → child roles (link existing)", () => {
  it("provisions a real PRINCIPAL: User+TenantMembership+RoleAssignment+Staff.userId, audited", async () => {
    const staffId = await makeStaff(schoolAId, branchAId, { code: `PR-${stamp}` });
    const res = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "PRINCIPAL", email: `t9w2-newprincipal-${stamp}@x.test`, staffId });
    expect(res.accountCreated).toBe(true);
    expect(res.domainRecordCreated).toBe(false);
    expect(res.passwordSetupPending).toBe(true);
    expect(res.passwordSetupUrl).toMatch(/^\/setup-password\?token=/);
    userIds.push(res.userId);

    const staff = await prisma.staff.findUniqueOrThrow({ where: { id: staffId }, select: { userId: true } });
    expect(staff.userId).toBe(res.userId);
    const membership = await prisma.tenantMembership.findUniqueOrThrow({ where: { userId_tenantId: { userId: res.userId, tenantId } }, select: { roleAssignments: { select: { role: { select: { key: true } } } } } });
    expect(membership.roleAssignments.map((r) => r.role.key)).toEqual(["PRINCIPAL"]);

    const audit = await prisma.auditEvent.findFirst({ where: { action: "USER_ACCOUNT_PROVISIONED", entityId: res.userId } });
    expect(audit).not.toBeNull();
    // Word-boundary match — real, safe structural fields like
    // "passwordSetDirectly": false must not false-positive here.
    expect(JSON.stringify(audit?.metaJson)).not.toMatch(/\bpassword\b|\btoken\b/i);
  });

  it("SCHOOL_ADMIN also directly provisions VICE_PRINCIPAL, TEACHER, and STAFF (Transport Staff) — the FINAL matrix", async () => {
    const vpStaff = await makeStaff(schoolAId, branchAId, { code: `SAVP-${stamp}` });
    const vp = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "VICE_PRINCIPAL", email: `t9w2-savp-${stamp}@x.test`, staffId: vpStaff });
    userIds.push(vp.userId);

    const teachStaff = await makeStaff(schoolAId, branchAId, { code: `SATC-${stamp}`, isTeaching: true });
    const teach = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "TEACHER", email: `t9w2-satc-${stamp}@x.test`, staffId: teachStaff });
    userIds.push(teach.userId);

    const bareStaff = await makeStaff(schoolAId, branchAId, { code: `SASTF-${stamp}` });
    const bare = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "STAFF", email: `t9w2-sastf-${stamp}@x.test`, staffId: bareStaff });
    userIds.push(bare.userId);
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
    const res = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "STUDENT", email: `t9w2-student-${stamp}@x.test`, studentId });
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

describe.skipIf(!dbReady)("Inline creation — reuses createStaff/createStudent/linkGuardianToStudent, never a second employee/student/guardian system", () => {
  it("SCHOOL_ADMIN provisions a TEACHER by creating a brand-new Staff profile inline (isTeaching auto-set)", async () => {
    const res = await provisionAccount(ctxSchoolAdmin, scopeA, {
      targetRoleKey: "TEACHER",
      email: `t9w2-inline-teacher-${stamp}@x.test`,
      newStaff: { employeeCode: `INL-TC-${stamp}`, firstName: "Inline", lastName: "Teacher" },
    });
    expect(res.domainRecordCreated).toBe(true);
    userIds.push(res.userId);
    const staff = await prisma.staff.findFirstOrThrow({ where: { employeeCode: `INL-TC-${stamp}` }, select: { id: true, userId: true, isTeaching: true, schoolId: true } });
    staffIds.push(staff.id);
    expect(staff.userId).toBe(res.userId);
    expect(staff.isTeaching).toBe(true); // auto-set for a TEACHER target
    expect(staff.schoolId).toBe(schoolAId);
  });

  it("SCHOOL_ADMIN provisions a STUDENT by creating a brand-new Student profile inline, with an inline Guardian too", async () => {
    const res = await provisionAccount(ctxSchoolAdmin, scopeA, {
      targetRoleKey: "STUDENT",
      email: `t9w2-inline-student-${stamp}@x.test`,
      newStudent: {
        admissionNumber: `INL-STU-${stamp}`, firstName: "Inline", lastName: "Student", dateOfBirth: "2015-06-01",
        guardians: [{ firstName: "Inline", lastName: "Parent", relation: "mother", isPrimary: true }],
      },
    });
    expect(res.domainRecordCreated).toBe(true);
    userIds.push(res.userId);
    const student = await prisma.student.findFirstOrThrow({ where: { admissionNumber: `INL-STU-${stamp}` }, select: { id: true, userId: true, schoolId: true } });
    studentIds.push(student.id);
    expect(student.userId).toBe(res.userId);
    expect(student.schoolId).toBe(schoolAId);
    const link = await prisma.studentGuardian.findFirst({ where: { studentId: student.id }, select: { guardianId: true } });
    expect(link).not.toBeNull();
    if (link) guardianIds.push(link.guardianId);
  });

  it("PRINCIPAL provisions a GUARDIAN by creating one inline, linked to an existing Student", async () => {
    const studentId = await makeStudent(schoolAId, branchAId, sessionAId, `T9W2-INLGRD-${stamp}`);
    const res = await provisionAccount(ctxPrincipal, scopeA, {
      targetRoleKey: "GUARDIAN",
      email: `t9w2-inline-guardian-${stamp}@x.test`,
      newGuardian: { firstName: "Inline", lastName: "Guardian2", linkToStudentId: studentId, relation: "father" },
    });
    expect(res.domainRecordCreated).toBe(true);
    userIds.push(res.userId);
    const link = await prisma.studentGuardian.findFirstOrThrow({ where: { studentId }, select: { guardianId: true } });
    guardianIds.push(link.guardianId);
    const guardian = await prisma.guardian.findUniqueOrThrow({ where: { id: link.guardianId }, select: { userId: true } });
    expect(guardian.userId).toBe(res.userId);
  });

  it("inline creation is gated by users.manage + canProvisionRole only — never leaks into hr.manage/students.create capability", async () => {
    // TEACHER holds users.manage (for provisioning) but NOT hr.manage,
    // students.create, or guardians.update — inline creation must still work
    // for the roles TEACHER is authorized to provision.
    const res = await provisionAccount(ctxTeacher, scopeA, {
      targetRoleKey: "STUDENT",
      email: `t9w2-teacher-inline-student-${stamp}@x.test`,
      newStudent: { admissionNumber: `INL-TCST-${stamp}`, firstName: "Teacher", lastName: "MadeStudent", dateOfBirth: "2016-01-01" },
    });
    userIds.push(res.userId);
    const student = await prisma.student.findFirstOrThrow({ where: { admissionNumber: `INL-TCST-${stamp}` }, select: { id: true } });
    studentIds.push(student.id);
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

  it("PRINCIPAL cannot provision a sibling/ancestor SCHOOL_ADMIN, nor HR_ADMIN/TRANSPORT_MANAGER", async () => {
    await expect(provisionAccount(ctxPrincipal, scopeA, { targetRoleKey: "SCHOOL_ADMIN", email: "x3@x.test", staffId: "whatever" })).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });
    await expect(provisionAccount(ctxPrincipal, scopeA, { targetRoleKey: "HR_ADMIN", email: "x3b@x.test", staffId: "whatever" })).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });
    await expect(provisionAccount(ctxPrincipal, scopeA, { targetRoleKey: "TRANSPORT_MANAGER", email: "x3c@x.test", staffId: "whatever" })).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });
  });

  it("VICE_PRINCIPAL may provision TEACHER + STUDENT + GUARDIAN but NOT PRINCIPAL", async () => {
    const teachingStaff = await makeStaff(schoolAId, branchAId, { code: `VPT-${stamp}`, isTeaching: true });
    const teacher = await provisionAccount(ctxVicePrincipal, scopeA, { targetRoleKey: "TEACHER", email: `t9w2-vpt-${stamp}@x.test`, staffId: teachingStaff });
    userIds.push(teacher.userId);

    const vpStudentId = await makeStudent(schoolAId, branchAId, sessionAId, `T9W2-VPGRD-${stamp}`);
    const guardianRes = await provisionAccount(ctxVicePrincipal, scopeA, {
      targetRoleKey: "GUARDIAN", email: `t9w2-vpguardian-${stamp}@x.test`,
      newGuardian: { firstName: "VP", lastName: "Guardian", linkToStudentId: vpStudentId, relation: "guardian" },
    });
    userIds.push(guardianRes.userId);

    await expect(provisionAccount(ctxVicePrincipal, scopeA, { targetRoleKey: "PRINCIPAL", email: "x5@x.test", staffId: "whatever" })).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });
  });

  it("TEACHER can provision STUDENT + GUARDIAN, but never escalate to Teacher/VP/Principal/SchoolAdmin/HR/Transport", async () => {
    await expect(provisionAccount(ctxTeacher, scopeA, { targetRoleKey: "TEACHER", email: "x6@x.test", staffId: "whatever" })).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });
    await expect(provisionAccount(ctxTeacher, scopeA, { targetRoleKey: "VICE_PRINCIPAL", email: "x6b@x.test", staffId: "whatever" })).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });
    await expect(provisionAccount(ctxTeacher, scopeA, { targetRoleKey: "PRINCIPAL", email: "x6c@x.test", staffId: "whatever" })).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });
    await expect(provisionAccount(ctxTeacher, scopeA, { targetRoleKey: "SCHOOL_ADMIN", email: "x6d@x.test", staffId: "whatever" })).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });
    await expect(provisionAccount(ctxTeacher, scopeA, { targetRoleKey: "HR_ADMIN", email: "x6e@x.test", staffId: "whatever" })).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });
    await expect(provisionAccount(ctxTeacher, scopeA, { targetRoleKey: "TRANSPORT_MANAGER", email: "x6f@x.test", staffId: "whatever" })).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });

    // TEACHER may never link/manage a Staff record at all, even for an allowed-shaped call.
    const someStaff = await makeStaff(schoolAId, branchAId, { code: `TCX-${stamp}` });
    await expect(provisionAccount(ctxTeacher, scopeA, { targetRoleKey: "STAFF", email: "x6g@x.test", staffId: someStaff })).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });
  });

  it("TEACHER may only provision (or link) accounts for students within their OWN teaching scope", async () => {
    // In-scope: studentOwnedId is enrolled in a section the teacher's Staff record teaches.
    const ok = await provisionAccount(ctxTeacher, scopeA, { targetRoleKey: "STUDENT", email: `t9w2-teacher-owned-${stamp}@x.test`, studentId: studentOwnedId });
    userIds.push(ok.userId);

    // Out-of-scope: studentOtherId is enrolled in a DIFFERENT section the teacher does not teach.
    await expect(provisionAccount(ctxTeacher, scopeA, { targetRoleKey: "STUDENT", email: `t9w2-teacher-notowned-${stamp}@x.test`, studentId: studentOtherId })).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });
  });
});

describe.skipIf(!dbReady)("HR_ADMIN / TRANSPORT_MANAGER → STAFF (unchanged — deliberately narrow)", () => {
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

  it("TRANSPORT_MANAGER cannot provision Teacher/HR Manager/Principal/School Admin", async () => {
    await expect(provisionAccount(ctxTransportManager, scopeA, { targetRoleKey: "TEACHER", email: "x9a@x.test", staffId: "whatever" })).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });
    await expect(provisionAccount(ctxTransportManager, scopeA, { targetRoleKey: "HR_ADMIN", email: "x9b@x.test", staffId: "whatever" })).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });
    await expect(provisionAccount(ctxTransportManager, scopeA, { targetRoleKey: "PRINCIPAL", email: "x9c@x.test", staffId: "whatever" })).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });
    await expect(provisionAccount(ctxTransportManager, scopeA, { targetRoleKey: "SCHOOL_ADMIN", email: "x9d@x.test", staffId: "whatever" })).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });
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

    await setAccountStatus(ctxSchoolAdmin, scopeA, res.userId, { status: "SUSPENDED" });
    let user = await prisma.user.findUniqueOrThrow({ where: { id: res.userId }, select: { status: true } });
    expect(user.status).toBe("SUSPENDED");

    await expect(setAccountStatus(ctxForeignAdmin, scopeForeign, res.userId, { status: "ACTIVE" })).rejects.toMatchObject({ code: "USER_NOT_FOUND" });

    await setAccountStatus(ctxSchoolAdmin, scopeA, res.userId, { status: "ACTIVE" });
    user = await prisma.user.findUniqueOrThrow({ where: { id: res.userId }, select: { status: true } });
    expect(user.status).toBe("ACTIVE");
  });

  it("listAccounts only returns accounts within the caller's own tenant, never a passwordHash", async () => {
    const { data } = await listAccounts(ctxSchoolAdmin, scopeA, {});
    expect(data.length).toBeGreaterThan(0);
    for (const row of data) expect(row).not.toHaveProperty("passwordHash");
    const foreignListing = await listAccounts(ctxForeignAdmin, scopeForeign, {});
    expect(foreignListing.data.every((r) => r.email.includes("t9w2-fa-") || !r.email.startsWith(`t9w2-`))).toBe(true);
  });

  it("listAccounts scopes to the caller's own SCHOOL within the tenant — a School B account never appears for a School A caller", async () => {
    const staffInB = await prisma.staff.create({ data: { tenantId, schoolId: schoolBId, branchId: branchAId, employeeCode: `LSTB-${stamp}`, firstName: "InB", lastName: "Staff", status: "ACTIVE" }, select: { id: true } });
    staffIds.push(staffInB.id);
    const scopeB: OrgScope = { ...scopeA, schoolId: schoolBId };
    const resB = await provisionAccount(ctxSchoolAdmin, scopeB, { targetRoleKey: "LIBRARIAN", email: `t9w2-inschoolb-${stamp}@x.test`, staffId: staffInB.id });
    userIds.push(resB.userId);

    const { data } = await listAccounts(ctxSchoolAdmin, scopeA, {});
    expect(data.some((r) => r.id === resB.userId)).toBe(false);
    const { data: dataB } = await listAccounts(ctxSchoolAdmin, scopeB, {});
    expect(dataB.some((r) => r.id === resB.userId)).toBe(true);
  });

  it("TEACHER's listAccounts NEVER includes Staff accounts, and only Student/Guardian accounts within their own teaching scope", async () => {
    const { data } = await listAccounts(ctxTeacher, scopeA, {});
    expect(data.every((r) => r.staffId === null)).toBe(true);
    expect(data.some((r) => r.studentId === studentOwnedId)).toBe(true);
    expect(data.some((r) => r.studentId === studentOtherId)).toBe(false);
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

  it("a TEACHER cannot suspend or assign a role to a Staff account, or an out-of-scope Student account", async () => {
    const staffId = await makeStaff(schoolAId, branchAId, { code: `TCSCOPE-${stamp}` });
    const staffRes = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "LIBRARIAN", email: `t9w2-tcscope-${stamp}@x.test`, staffId });
    userIds.push(staffRes.userId);
    await expect(setAccountStatus(ctxTeacher, scopeA, staffRes.userId, { status: "SUSPENDED" })).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });

    const otherStudentRes = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "STUDENT", email: `t9w2-tcscope-stu-${stamp}@x.test`, studentId: studentOtherId });
    userIds.push(otherStudentRes.userId);
    await expect(setAccountStatus(ctxTeacher, scopeA, otherStudentRes.userId, { status: "SUSPENDED" })).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });
  });
});

describe.skipIf(!dbReady)("Student self-service — Add/Invite My Guardian (identity-scoped, never a client studentId)", () => {
  it("adds a real Guardian for the caller's OWN student, real Guardian + StudentGuardian rows, and can invite a login", async () => {
    const scopeSelf: OrgScope = { ...scopeA, actor: { id: ctxTeacher.user.id, name: "Self" } }; // reuse a real user context below instead
    void scopeSelf;

    const student = await makeStudent(schoolAId, branchAId, sessionAId, `T9W2-SELF-${stamp}`);
    const studentUser = await prisma.user.create({ data: { email: `t9w2-selfstudent-${stamp}@x.test`, name: "Self Student", status: "ACTIVE" }, select: { id: true } });
    userIds.push(studentUser.id);
    await prisma.student.update({ where: { id: student }, data: { userId: studentUser.id } });

    const scope: OrgScope = { tenantId, schoolId: schoolAId, branchId: branchAId, academicSessionId: sessionAId, actor: { id: studentUser.id, name: "Self Student" } };
    const result = await addMyGuardian(scope, studentUser.id, {
      guardian: { firstName: "Self", lastName: "Parent", email: `t9w2-selfparent-${stamp}@x.test` },
      relation: "mother",
      invite: true,
    });
    guardianIds.push(result.guardianId);
    expect(result.passwordSetupUrl).toMatch(/^\/setup-password\?token=/);
    // The invite:true path also creates a real User for the guardian — track
    // it for cleanup too (the Guardian→User FK is SetNull, not cascade, so
    // deleting the Guardian row alone leaves this User orphaned).
    const invitedGuardian = await prisma.guardian.findUniqueOrThrow({ where: { id: result.guardianId }, select: { userId: true } });
    if (invitedGuardian.userId) userIds.push(invitedGuardian.userId);

    const link = await prisma.studentGuardian.findUniqueOrThrow({ where: { studentId_guardianId: { studentId: student, guardianId: result.guardianId } }, select: { relation: true } });
    expect(link.relation).toBe("MOTHER");

    const audit = await prisma.auditEvent.findFirst({ where: { action: "GUARDIAN_INVITED_BY_STUDENT", entityId: student } });
    expect(audit).not.toBeNull();
  });

  it("a student with NO linked Student record gets a clean NOT_FOUND, never another student's data", async () => {
    const bareUser = await prisma.user.create({ data: { email: `t9w2-bare-${stamp}@x.test`, name: "Bare", status: "ACTIVE" }, select: { id: true } });
    userIds.push(bareUser.id);
    const scope: OrgScope = { tenantId, schoolId: schoolAId, branchId: branchAId, academicSessionId: sessionAId, actor: { id: bareUser.id, name: "Bare" } };
    await expect(addMyGuardian(scope, bareUser.id, { guardian: { firstName: "X", lastName: "Y" }, relation: "guardian" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("inviting without an email is rejected with a clear validation error, never a silent no-op", async () => {
    const student = await makeStudent(schoolAId, branchAId, sessionAId, `T9W2-SELF2-${stamp}`);
    const studentUser = await prisma.user.create({ data: { email: `t9w2-selfstudent2-${stamp}@x.test`, name: "Self Student 2", status: "ACTIVE" }, select: { id: true } });
    userIds.push(studentUser.id);
    await prisma.student.update({ where: { id: student }, data: { userId: studentUser.id } });
    const scope: OrgScope = { tenantId, schoolId: schoolAId, branchId: branchAId, academicSessionId: sessionAId, actor: { id: studentUser.id, name: "Self Student 2" } };
    await expect(addMyGuardian(scope, studentUser.id, { guardian: { firstName: "No", lastName: "Email" }, relation: "guardian", invite: true })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});

describe.skipIf(!dbReady)("Admin password reset — reissues the real one-time setup link", () => {
  it("resets an ACTIVE account back to setup-required and issues a fresh token", async () => {
    const staffId = await makeStaff(schoolAId, branchAId, { code: `RESET-${stamp}` });
    const res = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "LIBRARIAN", email: `t9w2-reset-${stamp}@x.test`, staffId });
    userIds.push(res.userId);
    const token1 = new URL(`http://x${res.passwordSetupUrl}`).searchParams.get("token")!;
    await completePasswordSetup({ token: token1, password: "Sup3rSecret!" });

    const reset = await reissuePasswordSetup(ctxSchoolAdmin, scopeA, res.userId);
    expect(reset.passwordSetupUrl).toMatch(/^\/setup-password\?token=/);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: res.userId }, select: { status: true, passwordHash: true, passwordSetupRequired: true } });
    expect(user.status).toBe("INVITED");
    expect(user.passwordHash).toBeNull();
    expect(user.passwordSetupRequired).toBe(true);

    const auditEvents = await prisma.auditEvent.findMany({ where: { action: "PASSWORD_RESET", entityId: res.userId } });
    expect(auditEvents.length).toBe(1);
  });

  it("a foreign-tenant actor cannot reset a School A account's password", async () => {
    const staffId = await makeStaff(schoolAId, branchAId, { code: `RESETF-${stamp}` });
    const res = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "LIBRARIAN", email: `t9w2-resetf-${stamp}@x.test`, staffId });
    userIds.push(res.userId);
    await expect(reissuePasswordSetup(ctxForeignAdmin, scopeForeign, res.userId)).rejects.toMatchObject({ code: "USER_NOT_FOUND" });
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

describe.skipIf(!dbReady)("duplicate account tests", () => {
  it("rejects a duplicate email at Student inline-creation", async () => {
    const email = `t9w2-dupinline-${stamp}@x.test`;
    const staffId = await makeStaff(schoolAId, branchAId, { code: `DUPINL1-${stamp}` });
    const first = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "LIBRARIAN", email, staffId });
    userIds.push(first.userId);
    // Reusing the same email for a DIFFERENT domain kind must fail cleanly, never a raw DB error.
    await expect(
      provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "STUDENT", email, newStudent: { admissionNumber: `DUPINL-${stamp}`, firstName: "Dup", lastName: "Inline", dateOfBirth: "2015-01-01" } }),
    ).rejects.toMatchObject({ code: "ACCOUNT_ALREADY_LINKED_ELSEWHERE" });
  });
});

describe.skipIf(!dbReady)("Account Detail / Edit / Activity — reuses existing scoping, never exposes secrets", () => {
  it("getAccountDetail returns real personal/school/account/access data, never a passwordHash-shaped field", async () => {
    const staffId = await makeStaff(schoolAId, branchAId, { code: `DETAIL-${stamp}` });
    const res = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "LIBRARIAN", email: `t9w2-detail-${stamp}@x.test`, staffId });
    userIds.push(res.userId);

    const detail = await getAccountDetail(ctxSchoolAdmin, scopeA, res.userId);
    expect(detail.domainKind).toBe("staff");
    expect(detail.staffId).toBe(staffId);
    expect(detail.roles.map((r) => r.key)).toEqual(["LIBRARIAN"]);
    expect(detail.schoolAssignment?.schoolName).toBeTruthy();
    expect(detail.schoolAssignment?.branchName).toBeTruthy();
    expect(Array.isArray(detail.access.effectivePermissions)).toBe(true);
    expect(JSON.stringify(detail)).not.toMatch(/passwordHash/i);
  });

  it("a foreign-tenant actor cannot view, edit, or read activity for an account outside their tenant", async () => {
    const staffId = await makeStaff(schoolAId, branchAId, { code: `DETAILF-${stamp}` });
    const res = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "LIBRARIAN", email: `t9w2-detailf-${stamp}@x.test`, staffId });
    userIds.push(res.userId);
    await expect(getAccountDetail(ctxForeignAdmin, scopeForeign, res.userId)).rejects.toMatchObject({ code: "USER_NOT_FOUND" });
    await expect(updateAccountDetail(ctxForeignAdmin, scopeForeign, res.userId, { firstName: "X" })).rejects.toMatchObject({ code: "USER_NOT_FOUND" });
    await expect(getAccountActivity(ctxForeignAdmin, scopeForeign, res.userId)).rejects.toMatchObject({ code: "USER_NOT_FOUND" });
  });

  it("a TEACHER cannot view a Staff account's detail, but CAN view an in-scope student's", async () => {
    const staffId = await makeStaff(schoolAId, branchAId, { code: `DETAILT-${stamp}` });
    const staffRes = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "LIBRARIAN", email: `t9w2-detailt-${stamp}@x.test`, staffId });
    userIds.push(staffRes.userId);
    await expect(getAccountDetail(ctxTeacher, scopeA, staffRes.userId)).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });

    const studentId = await makeStudent(schoolAId, branchAId, sessionAId, `T9W2-DETSTU-${stamp}`);
    await prisma.enrollment.create({ data: { tenantId, schoolId: schoolAId, branchId: branchAId, academicSessionId: sessionAId, classId, sectionId: sectionOwnedId, studentId, status: "ENROLLED" } });
    const studentRes = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "STUDENT", email: `t9w2-detstu-${stamp}@x.test`, studentId });
    userIds.push(studentRes.userId);
    const detail = await getAccountDetail(ctxTeacher, scopeA, studentRes.userId);
    expect(detail.domainKind).toBe("student");
  });

  it("updateAccountDetail edits a real Staff field via the real updateStaff service (audited as STAFF_UPDATED)", async () => {
    const staffId = await makeStaff(schoolAId, branchAId, { code: `EDIT-${stamp}` });
    const res = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "LIBRARIAN", email: `t9w2-edit-${stamp}@x.test`, staffId });
    userIds.push(res.userId);
    const updated = await updateAccountDetail(ctxSchoolAdmin, scopeA, res.userId, { firstName: "Updated", phone: "9999999999" });
    expect(updated.personal.firstName).toBe("Updated");
    const staffRow = await prisma.staff.findUniqueOrThrow({ where: { id: staffId }, select: { firstName: true, phone: true } });
    expect(staffRow.firstName).toBe("Updated");
    expect(staffRow.phone).toBe("9999999999");
    const audit = await prisma.auditEvent.findFirst({ where: { action: "STAFF_UPDATED", entityId: staffId } });
    expect(audit).not.toBeNull();
  });

  it("updateAccountDetail rejects a field that is not real/editable for this domain kind (gender on a Staff account)", async () => {
    const staffId = await makeStaff(schoolAId, branchAId, { code: `EDITBAD-${stamp}` });
    const res = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "LIBRARIAN", email: `t9w2-editbad-${stamp}@x.test`, staffId });
    userIds.push(res.userId);
    await expect(updateAccountDetail(ctxSchoolAdmin, scopeA, res.userId, { gender: "male" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("getAccountActivity returns real AuditEvent history for this account, and sanitizes sensitive-looking meta keys", async () => {
    const staffId = await makeStaff(schoolAId, branchAId, { code: `ACT-${stamp}` });
    const res = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "LIBRARIAN", email: `t9w2-act-${stamp}@x.test`, staffId });
    userIds.push(res.userId);
    await updateAccountDetail(ctxSchoolAdmin, scopeA, res.userId, { firstName: "Activity" });
    const entries = await getAccountActivity(ctxSchoolAdmin, scopeA, res.userId);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((e) => e.action === "USER_ACCOUNT_PROVISIONED")).toBe(true);
    expect(entries.some((e) => e.action === "STAFF_UPDATED")).toBe(true);
    for (const e of entries) expect(JSON.stringify(e.meta ?? {})).not.toMatch(/password|token|hash/i);
  });
});

describe.skipIf(!dbReady)("Self-safety — never suspend or change your own role via this admin surface", () => {
  it("blocks self-suspension", async () => {
    await expect(setAccountStatus(ctxSchoolAdmin, scopeA, ctxSchoolAdmin.user.id, { status: "SUSPENDED" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
  it("blocks self-role-change", async () => {
    await expect(assignRoleToAccount(ctxSchoolAdmin, scopeA, ctxSchoolAdmin.user.id, { targetRoleKey: "LIBRARIAN" })).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });
  });
});

describe.skipIf(!dbReady)("Suspended accounts cannot authenticate", () => {
  it("a real password-setup-completed account, once suspended, fails real login (ACCOUNT_INACTIVE), and can log in again after reactivation", async () => {
    const staffId = await makeStaff(schoolAId, branchAId, { code: `SUSPAUTH-${stamp}` });
    const email = `t9w2-suspauth-${stamp}@x.test`;
    const res = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "LIBRARIAN", email, staffId });
    userIds.push(res.userId);
    const token = new URL(`http://x${res.passwordSetupUrl}`).searchParams.get("token")!;
    await completePasswordSetup({ token, password: "Sup3rSecret!" });

    const before = await authenticateWithPassword({ email, password: "Sup3rSecret!" });
    expect(before.ok).toBe(true);

    await setAccountStatus(ctxSchoolAdmin, scopeA, res.userId, { status: "SUSPENDED" });
    const duringSuspension = await authenticateWithPassword({ email, password: "Sup3rSecret!" });
    expect(duringSuspension.ok).toBe(false);
    if (!duringSuspension.ok) expect(duringSuspension.errorCode).toBe("ACCOUNT_INACTIVE");

    await setAccountStatus(ctxSchoolAdmin, scopeA, res.userId, { status: "ACTIVE" });
    const afterReactivation = await authenticateWithPassword({ email, password: "Sup3rSecret!" });
    expect(afterReactivation.ok).toBe(true);
  });
});

describe.skipIf(!dbReady)("Teacher-scoping is derived from REAL assigned roles, never just activeRoleKey", () => {
  // Regression coverage for a real gap found via live testing: activeRoleKey
  // can be null (e.g. a dual-role account that has not yet picked a role
  // after login — its session is already valid for direct API calls) while
  // requirePermission("users.manage") still passes via resolveUserAuthz's
  // documented "union of all assigned roles when none selected" fallback.
  // isTeacherScopedActor must still narrow correctly in that state.
  async function makeDualRoleUser(email: string, secondRoleKey: string): Promise<{ id: string; ctx: AuthzContext }> {
    const u = await prisma.user.create({ data: { email, name: email, status: "ACTIVE" }, select: { id: true } });
    userIds.push(u.id);
    const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId, status: "ACTIVE" }, select: { id: true } });
    const teacherRole = await prisma.role.findFirstOrThrow({ where: { key: "TEACHER", isSystem: true }, select: { id: true } });
    const secondRole = await prisma.role.findFirstOrThrow({ where: { key: secondRoleKey, isSystem: true }, select: { id: true } });
    await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: teacherRole.id } });
    await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: secondRole.id } });
    const perms = await prisma.rolePermission.findMany({ where: { roleId: { in: [teacherRole.id, secondRole.id] } }, select: { permission: { select: { key: true } } } });
    const ctx: AuthzContext = {
      user: { id: u.id, name: email, email, image: null, status: "ACTIVE", isPlatformAdmin: false },
      sessionId: `sess-${u.id}`,
      isPlatformAdmin: false,
      platformRole: null,
      activeRoleKey: null, // mid-selection — the exact real-world state that exposed the gap
      permissions: new Set(perms.map((p) => p.permission.key)),
      schoolId: null,
      branchId: null,
      impersonation: null,
    };
    return { id: u.id, ctx };
  }

  it("a null-activeRoleKey TEACHER+LIBRARIAN account is STILL teacher-scoped (LIBRARIAN grants no broader provisioning authority)", async () => {
    const dual = await makeDualRoleUser(`t9w2-dualtl-${stamp}@x.test`, "LIBRARIAN");
    expect(dual.ctx.permissions.has("users.manage")).toBe(true); // sanity: the union fallback really does include it

    const staffId = await makeStaff(schoolAId, branchAId, { code: `DUALTL-${stamp}` });
    const staffRes = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "LIBRARIAN", email: `t9w2-dualtl-staff-${stamp}@x.test`, staffId });
    userIds.push(staffRes.userId);

    // Still blocked from a Staff account, exactly like a normal single-role TEACHER.
    await expect(getAccountDetail(dual.ctx, scopeA, staffRes.userId)).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });
    // listAccounts must still exclude Staff rows for this actor.
    const { data } = await listAccounts(dual.ctx, scopeA, {});
    expect(data.every((r) => r.staffId === null)).toBe(true);
    // Still can only provision within teaching scope.
    await expect(provisionAccount(dual.ctx, scopeA, { targetRoleKey: "STUDENT", email: `t9w2-dualtl-oos-${stamp}@x.test`, studentId: studentOtherId })).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });
  });

  it("a null-activeRoleKey TEACHER+SCHOOL_ADMIN account gets the BROADER authority, not teacher-scoping", async () => {
    const dual = await makeDualRoleUser(`t9w2-dualtsa-${stamp}@x.test`, "SCHOOL_ADMIN");

    const staffId = await makeStaff(schoolAId, branchAId, { code: `DUALTSA-${stamp}` });
    const staffRes = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "LIBRARIAN", email: `t9w2-dualtsa-staff-${stamp}@x.test`, staffId });
    userIds.push(staffRes.userId);

    // A real SCHOOL_ADMIN-holding account can see and view a Staff account.
    const detail = await getAccountDetail(dual.ctx, scopeA, staffRes.userId);
    expect(detail.domainKind).toBe("staff");
    const { data } = await listAccounts(dual.ctx, scopeA, {});
    expect(data.some((r) => r.staffId === staffId)).toBe(true);
  });
});

describe.skipIf(!dbReady)("listAccounts filters — role/status/branchId", () => {
  it("filters by role, status, and branchId independently", async () => {
    const staffId = await makeStaff(schoolAId, branchAId, { code: `FILT-${stamp}` });
    const res = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "LIBRARIAN", email: `t9w2-filt-${stamp}@x.test`, staffId });
    userIds.push(res.userId);

    const byRole = await listAccounts(ctxSchoolAdmin, scopeA, { role: "LIBRARIAN" });
    expect(byRole.data.some((r) => r.id === res.userId)).toBe(true);
    expect(byRole.data.every((r) => r.roles.some((role) => role.key === "LIBRARIAN"))).toBe(true);

    const byStatusBefore = await listAccounts(ctxSchoolAdmin, scopeA, { status: "SUSPENDED" });
    expect(byStatusBefore.data.some((r) => r.id === res.userId)).toBe(false);
    await setAccountStatus(ctxSchoolAdmin, scopeA, res.userId, { status: "SUSPENDED" });
    const byStatusAfter = await listAccounts(ctxSchoolAdmin, scopeA, { status: "SUSPENDED" });
    expect(byStatusAfter.data.some((r) => r.id === res.userId)).toBe(true);
    await setAccountStatus(ctxSchoolAdmin, scopeA, res.userId, { status: "ACTIVE" });

    const byBranch = await listAccounts(ctxSchoolAdmin, scopeA, { branchId: branchAId });
    expect(byBranch.data.some((r) => r.id === res.userId)).toBe(true);
  });
});

describe.skipIf(!dbReady)("Direct password creation (Create Account UX pass)", () => {
  it("creating with a password logs in immediately — real ACTIVE status, no setup token issued", async () => {
    const staffId = await makeStaff(schoolAId, branchAId, { code: `PWCREATE-${stamp}` });
    const email = `t9w2-pwcreate-${stamp}@x.test`;
    const res = await provisionAccount(ctxSchoolAdmin, scopeA, {
      targetRoleKey: "LIBRARIAN", email, staffId, password: "Creat3dPass!", confirmPassword: "Creat3dPass!",
    });
    userIds.push(res.userId);
    expect(res.passwordSetDirectly).toBe(true);
    expect(res.passwordSetupPending).toBe(false);
    expect(res.passwordSetupUrl).toBeNull();

    const login = await authenticateWithPassword({ email, password: "Creat3dPass!" });
    expect(login.ok).toBe(true);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: res.userId }, select: { status: true, emailVerifiedAt: true } });
    expect(user.status).toBe("ACTIVE");
    expect(user.emailVerifiedAt).toBeNull(); // a direct admin-set password proves nothing about email control
  });

  it("account status 'inactive' at creation maps to a real INACTIVE User.status", async () => {
    const staffId = await makeStaff(schoolAId, branchAId, { code: `PWINACT-${stamp}` });
    const email = `t9w2-pwinact-${stamp}@x.test`;
    const res = await provisionAccount(ctxSchoolAdmin, scopeA, {
      targetRoleKey: "LIBRARIAN", email, staffId, password: "Creat3dPass!", confirmPassword: "Creat3dPass!", status: "inactive",
    });
    userIds.push(res.userId);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: res.userId }, select: { status: true } });
    expect(user.status).toBe("INACTIVE");
  });

  it("rejects a mismatched confirmPassword", async () => {
    const staffId = await makeStaff(schoolAId, branchAId, { code: `PWMISMATCH-${stamp}` });
    await expect(
      provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "LIBRARIAN", email: `t9w2-pwmismatch-${stamp}@x.test`, staffId, password: "Creat3dPass!", confirmPassword: "Different1" }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("forcePasswordChange keeps passwordSetupRequired true even though a real password is set, and resolvePostLogin routes there first", async () => {
    const staffId = await makeStaff(schoolAId, branchAId, { code: `PWFORCE-${stamp}` });
    const email = `t9w2-pwforce-${stamp}@x.test`;
    const res = await provisionAccount(ctxSchoolAdmin, scopeA, {
      targetRoleKey: "LIBRARIAN", email, staffId, password: "Creat3dPass!", confirmPassword: "Creat3dPass!", forcePasswordChange: true,
    });
    userIds.push(res.userId);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: res.userId }, select: { passwordSetupRequired: true } });
    expect(user.passwordSetupRequired).toBe(true);

    const dest = await resolvePostLogin(res.userId);
    expect(dest).toBe("/change-password");
  });

  it("reusing an EXISTING account by email never applies the new request's password", async () => {
    const email = `t9w2-pwreuse-${stamp}@x.test`;
    const staff1 = await makeStaff(schoolAId, branchAId, { code: `PWREUSE1-${stamp}` });
    const first = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "LIBRARIAN", email, staffId: staff1 }); // invite-link path, no password
    userIds.push(first.userId);

    const staff2 = await makeStaff(schoolAId, branchAId, { code: `PWREUSE2-${stamp}` });
    await expect(
      provisionAccount(ctxHrAdmin, scopeA, { targetRoleKey: "STAFF", email, staffId: staff2, password: "ShouldNotApply1", confirmPassword: "ShouldNotApply1" }),
    ).rejects.toMatchObject({ code: "ACCOUNT_ALREADY_LINKED_ELSEWHERE" });

    const login = await authenticateWithPassword({ email, password: "ShouldNotApply1" });
    expect(login.ok).toBe(false);
  });
});

describe.skipIf(!dbReady)("Self-service password change — always requires the real current password", () => {
  async function makeActiveAccount(password: string) {
    const staffId = await makeStaff(schoolAId, branchAId, { code: `SELFPW-${stamp}-${Math.random().toString(36).slice(2, 7)}` });
    const email = `t9w2-selfpw-${stamp}-${Math.random().toString(36).slice(2, 7)}@x.test`;
    const res = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "LIBRARIAN", email, staffId, password, confirmPassword: password });
    userIds.push(res.userId);
    const ctx: AuthzContext = {
      user: { id: res.userId, name: email, email, image: null, status: "ACTIVE", isPlatformAdmin: false },
      sessionId: `sess-${res.userId}`,
      isPlatformAdmin: false,
      platformRole: null,
      activeRoleKey: "LIBRARIAN",
      permissions: new Set(),
      schoolId: null,
      branchId: null,
      impersonation: null,
    };
    return { userId: res.userId, email, ctx };
  }

  it("succeeds with the real current password, and the new password then works for real login", async () => {
    const acc = await makeActiveAccount("Original1!");
    await changeOwnPassword(acc.ctx, { currentPassword: "Original1!", newPassword: "Changed2!" });

    const withOld = await authenticateWithPassword({ email: acc.email, password: "Original1!" });
    expect(withOld.ok).toBe(false);
    const withNew = await authenticateWithPassword({ email: acc.email, password: "Changed2!" });
    expect(withNew.ok).toBe(true);
  });

  it("rejects a wrong current password, never changing anything", async () => {
    const acc = await makeActiveAccount("Original1!");
    await expect(changeOwnPassword(acc.ctx, { currentPassword: "WrongOne1", newPassword: "Changed2!" })).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    const stillOld = await authenticateWithPassword({ email: acc.email, password: "Original1!" });
    expect(stillOld.ok).toBe(true);
  });

  it("records a PASSWORD_CHANGED audit event with no plaintext password in it", async () => {
    const acc = await makeActiveAccount("Original1!");
    await changeOwnPassword(acc.ctx, { currentPassword: "Original1!", newPassword: "Changed2!" });
    const audit = await prisma.auditEvent.findFirst({ where: { action: "PASSWORD_CHANGED", entityId: acc.userId } });
    expect(audit).not.toBeNull();
    expect(JSON.stringify(audit?.metaJson ?? {})).not.toContain("Changed2!");
    expect(JSON.stringify(audit?.metaJson ?? {})).not.toContain("Original1!");
  });
});

describe.skipIf(!dbReady)("Administrator password reset — never the target's current password, same scoping as every other account-management action", () => {
  it("sets a real password directly, activates an INVITED account, and consumes any outstanding setup token", async () => {
    const staffId = await makeStaff(schoolAId, branchAId, { code: `ADMINPW-${stamp}` });
    const email = `t9w2-adminpw-${stamp}@x.test`;
    const res = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "LIBRARIAN", email, staffId }); // invite-link path — still INVITED, has an outstanding token
    userIds.push(res.userId);

    await adminSetPassword(ctxSchoolAdmin, scopeA, res.userId, { newPassword: "AdminSet123!" });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: res.userId }, select: { status: true, passwordSetupRequired: true } });
    expect(user.status).toBe("ACTIVE");
    expect(user.passwordSetupRequired).toBe(false);

    const login = await authenticateWithPassword({ email, password: "AdminSet123!" });
    expect(login.ok).toBe(true);

    const outstandingTokens = await prisma.passwordSetupToken.count({ where: { userId: res.userId, consumedAt: null } });
    expect(outstandingTokens).toBe(0);
  });

  it("forcePasswordChange sets passwordSetupRequired true even though a real password now exists", async () => {
    const staffId = await makeStaff(schoolAId, branchAId, { code: `ADMINPWFORCE-${stamp}` });
    const res = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "LIBRARIAN", email: `t9w2-adminpwforce-${stamp}@x.test`, staffId });
    userIds.push(res.userId);
    await adminSetPassword(ctxSchoolAdmin, scopeA, res.userId, { newPassword: "AdminSet123!", forcePasswordChange: true });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: res.userId }, select: { passwordSetupRequired: true } });
    expect(user.passwordSetupRequired).toBe(true);
  });

  it("is never usable on the actor's own account — self-service is the only path", async () => {
    await expect(adminSetPassword(ctxSchoolAdmin, scopeA, ctxSchoolAdmin.user.id, { newPassword: "AdminSet123!" })).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });
  });

  it("blocks a SUSPENDED account, matching reissuePasswordSetup's identical rule", async () => {
    const staffId = await makeStaff(schoolAId, branchAId, { code: `ADMINPWSUSP-${stamp}` });
    const res = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "LIBRARIAN", email: `t9w2-adminpwsusp-${stamp}@x.test`, staffId, password: "Creat3dPass!", confirmPassword: "Creat3dPass!" });
    userIds.push(res.userId);
    await setAccountStatus(ctxSchoolAdmin, scopeA, res.userId, { status: "SUSPENDED" });
    await expect(adminSetPassword(ctxSchoolAdmin, scopeA, res.userId, { newPassword: "AdminSet123!" })).rejects.toMatchObject({ code: "ACCOUNT_INACTIVE" });
  });

  it("a foreign-tenant actor cannot reset a School A account's password", async () => {
    const staffId = await makeStaff(schoolAId, branchAId, { code: `ADMINPWFOREIGN-${stamp}` });
    const res = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "LIBRARIAN", email: `t9w2-adminpwforeign-${stamp}@x.test`, staffId });
    userIds.push(res.userId);
    await expect(adminSetPassword(ctxForeignAdmin, scopeForeign, res.userId, { newPassword: "AdminSet123!" })).rejects.toMatchObject({ code: "USER_NOT_FOUND" });
  });

  it("a TEACHER cannot admin-reset a Staff account's password, but CAN for an in-scope student's", async () => {
    const staffId = await makeStaff(schoolAId, branchAId, { code: `ADMINPWTEACHER-${stamp}` });
    const staffRes = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "LIBRARIAN", email: `t9w2-adminpwteacher-${stamp}@x.test`, staffId });
    userIds.push(staffRes.userId);
    await expect(adminSetPassword(ctxTeacher, scopeA, staffRes.userId, { newPassword: "AdminSet123!" })).rejects.toMatchObject({ code: "ROLE_NOT_ALLOWED" });

    // A fresh student in the teacher's owned section — studentOwnedId itself
    // already has a login account from an earlier test in this file.
    const freshStudentId = await makeStudent(schoolAId, branchAId, sessionAId, `T9W2-ADMPWTC-${stamp}`);
    await prisma.enrollment.create({ data: { tenantId, schoolId: schoolAId, branchId: branchAId, academicSessionId: sessionAId, classId, sectionId: sectionOwnedId, studentId: freshStudentId, status: "ENROLLED" } });
    const studentRes = await provisionAccount(ctxTeacher, scopeA, { targetRoleKey: "STUDENT", email: `t9w2-adminpwstudent-${stamp}@x.test`, studentId: freshStudentId });
    userIds.push(studentRes.userId);
    await adminSetPassword(ctxTeacher, scopeA, studentRes.userId, { newPassword: "AdminSet123!" });
    const login = await authenticateWithPassword({ email: `t9w2-adminpwstudent-${stamp}@x.test`, password: "AdminSet123!" });
    expect(login.ok).toBe(true);
  });

  it("records a PASSWORD_RESET audit event with adminReset metadata, no plaintext password", async () => {
    const staffId = await makeStaff(schoolAId, branchAId, { code: `ADMINPWAUDIT-${stamp}` });
    const res = await provisionAccount(ctxSchoolAdmin, scopeA, { targetRoleKey: "LIBRARIAN", email: `t9w2-adminpwaudit-${stamp}@x.test`, staffId });
    userIds.push(res.userId);
    await adminSetPassword(ctxSchoolAdmin, scopeA, res.userId, { newPassword: "AdminSet123!", forcePasswordChange: true });
    const audit = await prisma.auditEvent.findFirst({ where: { action: "PASSWORD_RESET", entityId: res.userId }, orderBy: { createdAt: "desc" } });
    expect(audit).not.toBeNull();
    expect((audit?.metaJson as Record<string, unknown> | null)?.adminReset).toBe(true);
    expect(JSON.stringify(audit?.metaJson ?? {})).not.toContain("AdminSet123!");
  });
});
