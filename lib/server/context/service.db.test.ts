// Workspace-context + resolver tests (Batch 4) — real DB. Creates isolated
// `__ctxtest__` tenants/schools/branches/sessions/users/memberships/roles and
// cleans them up. Skips if the DB is unreachable.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  ContextError,
  getAccessibleBranches,
  getAcademicSessions,
  getAccessibleSchools,
  getAssignedRoles,
  getCurrentContext,
  setAcademicSession,
  setBranch,
  setRole,
  setSchool,
} from "@/lib/server/context/service";
import { resolvePostLogin } from "@/lib/server/context/resolver";

const P = "__ctxtest__";

let dbReady = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  dbReady = true;
} catch {
  dbReady = false;
}

// Handles created during setup, for teardown + assertions.
const ids = {
  tenantA: "",
  tenantB: "",
  schoolA: "",
  schoolB: "",
  branchA1: "",
  branchA2: "",
  sessionA: "",
  roleTeacher: "",
  roleAdmin: "",
  // users
  single: "", // 1 school, 1 role, 1 branch(after select), 1 current session
  multiRole: "",
  resolverUser: "", // fresh: 1 school + 1 role + 2 branches → resolver hits /select-branch
};

async function makeUser(email: string) {
  return prisma.user.create({ data: { email, name: email, status: "ACTIVE", passwordHash: "x" } });
}

beforeAll(async () => {
  if (!dbReady) return;
  const tA = await prisma.tenant.create({ data: { name: P + "A", slug: P + "a" } });
  const tB = await prisma.tenant.create({ data: { name: P + "B", slug: P + "b" } });
  ids.tenantA = tA.id;
  ids.tenantB = tB.id;

  const sA = await prisma.school.create({ data: { tenantId: tA.id, name: P + "SchoolA", code: P + "SA" } });
  const sB = await prisma.school.create({ data: { tenantId: tB.id, name: P + "SchoolB", code: P + "SB" } });
  ids.schoolA = sA.id;
  ids.schoolB = sB.id;

  const b1 = await prisma.branch.create({ data: { schoolId: sA.id, name: P + "B1", code: P + "B1", isPrimary: true, status: "ACTIVE" } });
  const b2 = await prisma.branch.create({ data: { schoolId: sA.id, name: P + "B2", code: P + "B2", status: "ACTIVE" } });
  ids.branchA1 = b1.id;
  ids.branchA2 = b2.id;

  const ses = await prisma.academicSession.create({
    data: { schoolId: sA.id, name: P + "26-27", code: P + "2627", startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31"), status: "ACTIVE", isCurrent: true },
  });
  ids.sessionA = ses.id;

  const rTeacher = await prisma.role.create({ data: { key: P + "TEACHER", name: "Teacher", isSystem: false, tenantId: tA.id } });
  const rAdmin = await prisma.role.create({ data: { key: P + "SCHOOL_ADMIN", name: "Admin", isSystem: false, tenantId: tA.id } });
  ids.roleTeacher = rTeacher.id;
  ids.roleAdmin = rAdmin.id;

  // single-access user: tenant A, one role (teacher)
  const single = await makeUser(P + "single@x.example");
  ids.single = single.id;
  const mSingle = await prisma.tenantMembership.create({ data: { userId: single.id, tenantId: tA.id, status: "ACTIVE" } });
  await prisma.roleAssignment.create({ data: { membershipId: mSingle.id, roleId: rTeacher.id } });

  // multi-role user: tenant A, two roles
  const multi = await makeUser(P + "multi@x.example");
  ids.multiRole = multi.id;
  const mMulti = await prisma.tenantMembership.create({ data: { userId: multi.id, tenantId: tA.id, status: "ACTIVE" } });
  await prisma.roleAssignment.create({ data: { membershipId: mMulti.id, roleId: rTeacher.id } });
  await prisma.roleAssignment.create({ data: { membershipId: mMulti.id, roleId: rAdmin.id } });

  // resolver user: tenant A, one role, fresh (no stored context) → 2 branches.
  const resolver = await makeUser(P + "resolver@x.example");
  ids.resolverUser = resolver.id;
  const mResolver = await prisma.tenantMembership.create({ data: { userId: resolver.id, tenantId: tA.id, status: "ACTIVE" } });
  await prisma.roleAssignment.create({ data: { membershipId: mResolver.id, roleId: rTeacher.id } });
});

afterAll(async () => {
  if (!dbReady) return;
  await prisma.user.deleteMany({ where: { email: { startsWith: P } } });
  await prisma.tenant.deleteMany({ where: { slug: { startsWith: P } } }); // cascades schools/branches/sessions/roles
  await prisma.$disconnect();
});

describe.skipIf(!dbReady)("workspace context service + resolver", () => {
  it("returns only the user's own tenant schools", async () => {
    const schools = await getAccessibleSchools(ids.single);
    expect(schools.map((s) => s.id)).toEqual([ids.schoolA]);
    expect(schools.map((s) => s.id)).not.toContain(ids.schoolB);
  });

  it("returns only assigned roles", async () => {
    const roles = await getAssignedRoles(ids.single);
    expect(roles.map((r) => r.id)).toEqual([ids.roleTeacher]);
    const multi = await getAssignedRoles(ids.multiRole);
    expect(multi.map((r) => r.id).sort()).toEqual([ids.roleTeacher, ids.roleAdmin].sort());
  });

  it("TENANT ISOLATION: selecting another tenant's school is rejected", async () => {
    await expect(setSchool(ids.single, ids.schoolB)).rejects.toBeInstanceOf(ContextError);
    await expect(setSchool(ids.single, ids.schoolB)).rejects.toHaveProperty("code", "INVALID_SCHOOL");
  });

  it("rejects an unassigned/arbitrary role", async () => {
    await expect(setRole(ids.single, ids.roleAdmin)).rejects.toHaveProperty("code", "INVALID_ROLE"); // single has only teacher
    await expect(setRole(ids.single, "role-does-not-exist")).rejects.toHaveProperty("code", "INVALID_ROLE");
  });

  it("selects a valid school + role and reflects them in current context", async () => {
    await setSchool(ids.single, ids.schoolA);
    await setRole(ids.single, ids.roleTeacher);
    const ctx = await getCurrentContext(ids.single);
    expect(ctx.school?.id).toBe(ids.schoolA);
    expect(ctx.tenant?.id).toBe(ids.tenantA);
    expect(ctx.role?.id).toBe(ids.roleTeacher);
  });

  it("branch: accessible list is school-scoped; wrong-school branch rejected", async () => {
    await setSchool(ids.single, ids.schoolA); // resets branch/session
    const branches = await getAccessibleBranches(ids.single, ids.schoolA);
    expect(branches.map((b) => b.id).sort()).toEqual([ids.branchA1, ids.branchA2].sort());
    // A branch id that isn't in the selected school is rejected.
    await expect(setBranch(ids.single, "branch-not-here")).rejects.toHaveProperty("code", "INVALID_BRANCH");
    // Valid branch persists.
    await setBranch(ids.single, ids.branchA1);
    expect((await getCurrentContext(ids.single)).branch?.id).toBe(ids.branchA1);
  });

  it("academic session: valid persists, invalid rejected", async () => {
    const sessions = await getAcademicSessions(ids.single, ids.schoolA);
    expect(sessions.some((s) => s.id === ids.sessionA && s.isCurrent)).toBe(true);
    await expect(setAcademicSession(ids.single, "session-nope")).rejects.toHaveProperty("code", "INVALID_SESSION");
    await setAcademicSession(ids.single, ids.sessionA);
    expect((await getCurrentContext(ids.single)).academicSession?.id).toBe(ids.sessionA);
  });

  it("context survives across reads (persisted server-side, not client state)", async () => {
    const a = await getCurrentContext(ids.single);
    const b = await getCurrentContext(ids.single);
    expect(b.school?.id).toBe(a.school?.id);
    expect(b.branch?.id).toBe(a.branch?.id);
    expect(b.academicSession?.id).toBe(a.academicSession?.id);
  });

  it("resolver auto-selects single school/role and routes multi-branch to /select-branch", async () => {
    // Fresh user with no stored context → single school + single role auto-select,
    // 2 branches → /select-branch.
    const dest = await resolvePostLogin(ids.resolverUser);
    expect(dest).toBe("/select-branch");
    const ctx = await getCurrentContext(ids.resolverUser);
    expect(ctx.school?.id).toBe(ids.schoolA); // auto-selected
  });

  it("resolver routes a multi-role user to /select-role", async () => {
    const dest = await resolvePostLogin(ids.multiRole);
    expect(dest).toBe("/select-role");
  });

  it("resolver sends a user with no membership to /access-denied", async () => {
    const orphan = await makeUser(P + "orphan@x.example");
    expect(await resolvePostLogin(orphan.id)).toBe("/access-denied");
  });
});
