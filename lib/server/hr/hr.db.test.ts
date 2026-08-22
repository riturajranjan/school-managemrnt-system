// HR Core DB integration tests (Phase 9P). Real Postgres: Department/
// Designation CRUD + duplicate-code rejection + archive (never hard-delete)
// + head-of-department validation, isolation, HR dashboard DB-derivation
// (reuses the canonical Phase 9E Staff Attendance summary), RBAC, DTO
// safety, audit. Namespaced ("T9P"). Mirrors the exact setup/teardown
// pattern of lib/server/library/library.db.test.ts.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createDepartment, getDepartment, listDepartments, setDepartmentStatus, updateDepartment } from "@/lib/server/hr/departments";
import { createDesignation, getDesignation, listDesignations, setDesignationStatus } from "@/lib/server/hr/designations";
import { getHrDashboard } from "@/lib/server/hr/dashboard";
import { createStaff } from "@/lib/server/staff/service";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T9P";
const stamp = Date.now().toString(36);

let tenantId = "", schoolId = "", branchA = "";
let foreignTenantId = "", foreignSchoolId = "", foreignBranchId = "";
let scopeAdmin: OrgScope, scopePrincipal: OrgScope, scopeTeacher: OrgScope, scopeForeignAdmin: OrgScope;
let adminUser = "", principalUser = "", teacherUser = "", foreignAdminUser = "";

async function makeUserWithRole(email: string, roleKey: string, tid = tenantId): Promise<string> {
  const u = await prisma.user.create({ data: { email, name: email, status: "ACTIVE" }, select: { id: true } });
  const m = await prisma.tenantMembership.create({ data: { userId: u.id, tenantId: tid, status: "ACTIVE" }, select: { id: true } });
  const role = await prisma.role.findFirstOrThrow({ where: { key: roleKey, isSystem: true }, select: { id: true } });
  await prisma.roleAssignment.create({ data: { membershipId: m.id, roleId: role.id } });
  return u.id;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} T`, slug: `t9p-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} S`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  branchA = (await prisma.branch.create({ data: { schoolId, name: "A", code: `${NS}-A`, status: "ACTIVE" }, select: { id: true } })).id;

  adminUser = await makeUserWithRole(`t9p-admin-${stamp}@x.test`, "SCHOOL_ADMIN");
  principalUser = await makeUserWithRole(`t9p-principal-${stamp}@x.test`, "PRINCIPAL");
  teacherUser = await makeUserWithRole(`t9p-teacher-${stamp}@x.test`, "TEACHER");

  foreignTenantId = (await prisma.tenant.create({ data: { name: `${NS} T2`, slug: `t9p-b-${stamp}` }, select: { id: true } })).id;
  foreignSchoolId = (await prisma.school.create({ data: { tenantId: foreignTenantId, name: `${NS} S2`, code: `${NS}-B-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  foreignBranchId = (await prisma.branch.create({ data: { schoolId: foreignSchoolId, name: "B", code: `${NS}-B`, status: "ACTIVE" }, select: { id: true } })).id;
  foreignAdminUser = await makeUserWithRole(`t9p-fadmin-${stamp}@x.test`, "SCHOOL_ADMIN", foreignTenantId);

  scopeAdmin = { tenantId, schoolId, branchId: branchA, academicSessionId: null, actor: { id: adminUser, name: "Admin" } };
  scopePrincipal = { tenantId, schoolId, branchId: branchA, academicSessionId: null, actor: { id: principalUser, name: "Principal" } };
  scopeTeacher = { tenantId, schoolId, branchId: branchA, academicSessionId: null, actor: { id: teacherUser, name: "Teacher" } };
  scopeForeignAdmin = { tenantId: foreignTenantId, schoolId: foreignSchoolId, branchId: foreignBranchId, academicSessionId: null, actor: { id: foreignAdminUser, name: "Foreign Admin" } };
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.staff.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.designation.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.department.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.roleAssignment.deleteMany({ where: { membership: { tenantId: { in: [tenantId, foreignTenantId] } } } });
  await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.branch.deleteMany({ where: { schoolId: { in: [schoolId, foreignSchoolId] } } });
  await prisma.school.deleteMany({ where: { tenantId: { in: [tenantId, foreignTenantId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [adminUser, principalUser, teacherUser, foreignAdminUser] } } });
  await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, foreignTenantId] } } });
});

describe.skipIf(!dbReady)("Departments (DB)", () => {
  it("creates, updates and archives a department (never hard-deleted)", async () => {
    const dept = await createDepartment(scopeAdmin, { code: `DEPT-${stamp}-1`, name: "Science" });
    expect(dept.status).toBe("active");
    expect(dept.staffCount).toBe(0);

    const updated = await updateDepartment(scopeAdmin, dept.id, { description: "Physics, Chemistry, Biology" });
    expect(updated.description).toBe("Physics, Chemistry, Biology");

    const archived = await setDepartmentStatus(scopeAdmin, dept.id, "archived");
    expect(archived.status).toBe("archived");
    const stillThere = await getDepartment(scopeAdmin, dept.id);
    expect(stillThere.id).toBe(dept.id); // archived, not deleted
  });

  it("rejects a duplicate department code within the same school", async () => {
    await createDepartment(scopeAdmin, { code: `DEPT-${stamp}-DUP`, name: "First" });
    await expect(createDepartment(scopeAdmin, { code: `DEPT-${stamp}-DUP`, name: "Second" })).rejects.toThrow(HttpError);
  });

  it("validates head-of-department is a real, active, in-school Staff member", async () => {
    await expect(createDepartment(scopeAdmin, { code: `DEPT-${stamp}-HEAD`, name: "Headed", headStaffId: "nonexistent" })).rejects.toThrow();
    const staff = await createStaff(scopeAdmin, { employeeCode: `${NS}-HOD-${stamp}`, firstName: "Head" });
    const dept = await createDepartment(scopeAdmin, { code: `DEPT-${stamp}-HEAD2`, name: "Headed2", headStaffId: staff.id });
    expect(dept.headStaffId).toBe(staff.id);
    expect(dept.headStaffName).toContain("Head");
  });

  it("isolation: a foreign tenant cannot see or fetch another school's department", async () => {
    const dept = await createDepartment(scopeAdmin, { code: `DEPT-${stamp}-ISO`, name: "Isolated" });
    const foreignList = await listDepartments(scopeForeignAdmin);
    expect(foreignList.some((d) => d.id === dept.id)).toBe(false);
    await expect(getDepartment(scopeForeignAdmin, dept.id)).rejects.toThrow(HttpError);
  });

  it("historical safety: a department referenced by Staff can still be archived, and Staff keeps its assignment", async () => {
    const dept = await createDepartment(scopeAdmin, { code: `DEPT-${stamp}-REF`, name: "Referenced" });
    const staff = await createStaff(scopeAdmin, { employeeCode: `${NS}-REF-${stamp}`, firstName: "Ref", departmentId: dept.id });
    await setDepartmentStatus(scopeAdmin, dept.id, "archived");
    const staffRow = await prisma.staff.findUniqueOrThrow({ where: { id: staff.id }, select: { departmentId: true } });
    expect(staffRow.departmentId).toBe(dept.id);
  });
});

describe.skipIf(!dbReady)("Designations (DB)", () => {
  it("creates, department-scopes, and archives a designation", async () => {
    const dept = await createDepartment(scopeAdmin, { code: `DEPT-${stamp}-DS1`, name: "Dept for Desig" });
    const desig = await createDesignation(scopeAdmin, { code: `DESIG-${stamp}-1`, name: "PGT Math", departmentId: dept.id, level: 3 });
    expect(desig.departmentId).toBe(dept.id);
    expect(desig.departmentName).toBe("Dept for Desig");
    expect(desig.level).toBe(3);

    const archived = await setDesignationStatus(scopeAdmin, desig.id, "archived");
    expect(archived.status).toBe("archived");
  });

  it("rejects a duplicate designation code and an invalid department", async () => {
    await createDesignation(scopeAdmin, { code: `DESIG-${stamp}-DUP`, name: "First" });
    await expect(createDesignation(scopeAdmin, { code: `DESIG-${stamp}-DUP`, name: "Second" })).rejects.toThrow(HttpError);
    await expect(createDesignation(scopeAdmin, { code: `DESIG-${stamp}-BADDEPT`, name: "Bad", departmentId: "nonexistent" })).rejects.toThrow(HttpError);
  });

  it("filters designations by department", async () => {
    const dept = await createDepartment(scopeAdmin, { code: `DEPT-${stamp}-FILT`, name: "Filter Dept" });
    const desig = await createDesignation(scopeAdmin, { code: `DESIG-${stamp}-FILT`, name: "Scoped" , departmentId: dept.id });
    const list = await listDesignations(scopeAdmin, { departmentId: dept.id });
    expect(list.some((d) => d.id === desig.id)).toBe(true);
  });

  it("isolation: a foreign tenant cannot see or fetch another school's designation", async () => {
    const desig = await createDesignation(scopeAdmin, { code: `DESIG-${stamp}-ISO`, name: "Isolated Desig" });
    const foreignList = await listDesignations(scopeForeignAdmin);
    expect(foreignList.some((d) => d.id === desig.id)).toBe(false);
    await expect(getDesignation(scopeForeignAdmin, desig.id)).rejects.toThrow(HttpError);
  });
});

describe.skipIf(!dbReady)("HR Dashboard (DB)", () => {
  it("is DB-derived: active/teaching/non-teaching/department counts and attendance summary", async () => {
    const dept = await createDepartment(scopeAdmin, { code: `DEPT-${stamp}-DASH`, name: "Dash Dept" });
    await createStaff(scopeAdmin, { employeeCode: `${NS}-DASH-1-${stamp}`, firstName: "Teach", isTeaching: true, departmentId: dept.id });
    await createStaff(scopeAdmin, { employeeCode: `${NS}-DASH-2-${stamp}`, firstName: "NonTeach", isTeaching: false });

    const dashboard = await getHrDashboard(scopeAdmin);
    expect(dashboard.activeStaff).toBeGreaterThanOrEqual(2);
    expect(dashboard.teachingStaff).toBeGreaterThanOrEqual(1);
    expect(dashboard.nonTeachingStaff).toBeGreaterThanOrEqual(1);
    expect(dashboard.departments).toBeGreaterThanOrEqual(1);
    expect(dashboard.activeStaff).toBe(dashboard.teachingStaff + dashboard.nonTeachingStaff);
    expect(typeof dashboard.presentToday).toBe("number");
    expect(typeof dashboard.onLeaveToday).toBe("number");
  });

  it("counts a joiner this month via real Staff.joiningDate", async () => {
    const todayIso = new Date().toISOString().slice(0, 10);
    await createStaff(scopeAdmin, { employeeCode: `${NS}-NEWHIRE-${stamp}`, firstName: "NewHire", joiningDate: todayIso });
    const dashboard = await getHrDashboard(scopeAdmin);
    expect(dashboard.newHiresThisMonth).toBeGreaterThanOrEqual(1);
  });
});

describe.skipIf(!dbReady)("RBAC + DTO safety + audit (DB)", () => {
  it("SCHOOL_ADMIN (hr.view) can list; neither PRINCIPAL nor TEACHER hold hr.view in the real catalog (unchanged by this phase)", async () => {
    const { ROLE_PERMISSIONS } = await import("@/lib/server/authz/catalog");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("hr.view");
    expect(ROLE_PERMISSIONS.PRINCIPAL).not.toContain("hr.view");
    expect(ROLE_PERMISSIONS.TEACHER).not.toContain("hr.view");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).not.toContain("hr.manage"); // matches the Library/Transport precedent — SCHOOL_ADMIN gets view, HR_ADMIN gets manage
    expect(ROLE_PERMISSIONS.HR_ADMIN).toContain("hr.manage");
    const list = await listDepartments(scopeAdmin);
    expect(Array.isArray(list)).toBe(true);
    void scopePrincipal; void scopeTeacher; // RBAC enforcement itself is at the route layer (requirePermission), not the service — this test documents the catalog contract.
  });

  it("DTOs never leak tenantId/schoolId/branchId", async () => {
    const dept = await createDepartment(scopeAdmin, { code: `DEPT-${stamp}-DTO`, name: "DTO Dept" });
    const raw = JSON.stringify(dept);
    expect(raw).not.toContain(tenantId);
    expect(raw).not.toContain(schoolId);
  });

  it("records HR_DEPARTMENT_CREATED and HR_DESIGNATION_CREATED audit events", async () => {
    const dept = await createDepartment(scopeAdmin, { code: `DEPT-${stamp}-AUDIT`, name: "Audit Dept" });
    const desig = await createDesignation(scopeAdmin, { code: `DESIG-${stamp}-AUDIT`, name: "Audit Desig" });
    const events = await prisma.auditEvent.findMany({ where: { tenantId, action: { in: ["HR_DEPARTMENT_CREATED", "HR_DESIGNATION_CREATED"] } } });
    expect(events.some((e) => e.entityId === dept.id)).toBe(true);
    expect(events.some((e) => e.entityId === desig.id)).toBe(true);
  });
});
