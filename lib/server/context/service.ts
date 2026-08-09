// Workspace-context service (Batch 4) — resolves and persists the authenticated
// user's tenant → school → role → branch → academic-session selection from
// PostgreSQL. Tenant isolation is enforced here: every accessor is scoped to the
// user's own ACTIVE memberships, so a user can never read or select another
// tenant's school/branch/role/session. Selections are re-validated on read, so a
// stale/deleted id resolves to "unselected" (fail closed).
import { prisma } from "@/lib/db/prisma";

export class ContextError extends Error {
  constructor(
    public code: "INVALID_SCHOOL" | "INVALID_ROLE" | "INVALID_BRANCH" | "INVALID_SESSION" | "FORBIDDEN",
    message: string,
  ) {
    super(message);
  }
}

export type ContextSchool = { id: string; name: string; code: string; logo: null };
export type ContextRole = { id: string; key: string; name: string };
export type ContextBranch = { id: string; name: string; code: string; isPrimary: boolean };
export type ContextAcademicSession = { id: string; name: string; code: string; isCurrent: boolean };

export type CurrentContext = {
  user: { id: string; name: string | null; email: string };
  isPlatformAdmin: boolean;
  tenant: { id: string; name: string } | null;
  school: { id: string; name: string } | null;
  role: { id: string; name: string } | null;
  branch: { id: string; name: string } | null;
  academicSession: { id: string; name: string } | null;
};

type Membership = {
  tenantId: string;
  tenant: { id: string; name: string };
  roleAssignments: { role: { id: string; key: string; name: string } }[];
};

async function activeMemberships(userId: string): Promise<Membership[]> {
  return prisma.tenantMembership.findMany({
    where: { userId, status: "ACTIVE" },
    select: {
      tenantId: true,
      tenant: { select: { id: true, name: true } },
      roleAssignments: { select: { role: { select: { id: true, key: true, name: true } } } },
    },
  });
}

// --- Access (read) ---------------------------------------------------------

export async function getAccessibleSchools(userId: string): Promise<ContextSchool[]> {
  const memberships = await activeMemberships(userId);
  const tenantIds = memberships.map((m) => m.tenantId);
  if (tenantIds.length === 0) return [];
  const schools = await prisma.school.findMany({
    where: { tenantId: { in: tenantIds }, status: { not: "ARCHIVED" } },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });
  return schools.map((s) => ({ ...s, logo: null }));
}

export async function getAssignedRoles(userId: string): Promise<ContextRole[]> {
  const memberships = await activeMemberships(userId);
  const byId = new Map<string, ContextRole>();
  for (const m of memberships) {
    for (const ra of m.roleAssignments) {
      byId.set(ra.role.id, { id: ra.role.id, key: ra.role.key, name: ra.role.name });
    }
  }
  return [...byId.values()];
}

async function assertSchoolAccess(userId: string, schoolId: string): Promise<{ tenantId: string }> {
  const memberships = await activeMemberships(userId);
  const tenantIds = memberships.map((m) => m.tenantId);
  const school = await prisma.school.findFirst({
    where: { id: schoolId, tenantId: { in: tenantIds.length ? tenantIds : ["__none__"] } },
    select: { id: true, tenantId: true },
  });
  if (!school) throw new ContextError("INVALID_SCHOOL", "School not found or not accessible");
  return { tenantId: school.tenantId };
}

export async function getAccessibleBranches(userId: string, schoolId: string): Promise<ContextBranch[]> {
  await assertSchoolAccess(userId, schoolId);
  const branches = await prisma.branch.findMany({
    where: { schoolId, status: { not: "ARCHIVED" } },
    select: { id: true, name: true, code: true, isPrimary: true },
    orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
  });
  return branches;
}

export async function getAcademicSessions(userId: string, schoolId: string): Promise<ContextAcademicSession[]> {
  await assertSchoolAccess(userId, schoolId);
  const sessions = await prisma.academicSession.findMany({
    where: { schoolId, status: { not: "ARCHIVED" } },
    select: { id: true, name: true, code: true, isCurrent: true },
    orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
  });
  return sessions;
}

// --- Persistence (write, all access-validated) -----------------------------

async function upsertContext(userId: string, data: Record<string, string | null>) {
  await prisma.userActiveContext.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
}

export async function setSchool(userId: string, schoolId: string): Promise<void> {
  await assertSchoolAccess(userId, schoolId);
  // Changing school invalidates any branch/session that belonged to the old one.
  await upsertContext(userId, { schoolId, branchId: null, academicSessionId: null });
}

export async function setRole(userId: string, roleId: string): Promise<void> {
  const roles = await getAssignedRoles(userId);
  if (!roles.some((r) => r.id === roleId)) {
    throw new ContextError("INVALID_ROLE", "Role is not assigned to this user");
  }
  await upsertContext(userId, { roleId });
}

export async function setBranch(userId: string, branchId: string): Promise<void> {
  const ctx = await prisma.userActiveContext.findUnique({ where: { userId }, select: { schoolId: true } });
  if (!ctx?.schoolId) throw new ContextError("INVALID_BRANCH", "Select a school before a branch");
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, schoolId: ctx.schoolId },
    select: { id: true },
  });
  if (!branch) throw new ContextError("INVALID_BRANCH", "Branch not found in the selected school");
  await assertSchoolAccess(userId, ctx.schoolId); // defence in depth
  await upsertContext(userId, { branchId });
}

export async function setAcademicSession(userId: string, academicSessionId: string): Promise<void> {
  const ctx = await prisma.userActiveContext.findUnique({ where: { userId }, select: { schoolId: true } });
  if (!ctx?.schoolId) throw new ContextError("INVALID_SESSION", "Select a school before a session");
  const session = await prisma.academicSession.findFirst({
    where: { id: academicSessionId, schoolId: ctx.schoolId },
    select: { id: true },
  });
  if (!session) throw new ContextError("INVALID_SESSION", "Academic session not found in the selected school");
  await assertSchoolAccess(userId, ctx.schoolId);
  await upsertContext(userId, { academicSessionId });
}

// --- Current context (read, re-validated) ----------------------------------

export async function getCurrentContext(userId: string): Promise<CurrentContext> {
  const [user, memberships, stored] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, name: true, email: true, platformAdmin: { select: { id: true } } },
    }),
    activeMemberships(userId),
    prisma.userActiveContext.findUnique({ where: { userId } }),
  ]);

  const base: CurrentContext = {
    user: { id: user.id, name: user.name, email: user.email },
    isPlatformAdmin: Boolean(user.platformAdmin),
    tenant: null,
    school: null,
    role: null,
    branch: null,
    academicSession: null,
  };

  // School (re-validate access) → tenant derived from the school.
  let activeSchoolId: string | null = null;
  if (stored?.schoolId) {
    const school = await prisma.school.findFirst({
      where: { id: stored.schoolId, tenantId: { in: memberships.map((m) => m.tenantId) } },
      select: { id: true, name: true, tenant: { select: { id: true, name: true } } },
    });
    if (school) {
      activeSchoolId = school.id;
      base.school = { id: school.id, name: school.name };
      base.tenant = { id: school.tenant.id, name: school.tenant.name };
    }
  }
  // Fall back to the single tenant if school not chosen yet.
  if (!base.tenant && memberships.length === 1) {
    base.tenant = memberships[0].tenant;
  }

  // Role (re-validate assignment).
  if (stored?.roleId) {
    const assigned = memberships.flatMap((m) => m.roleAssignments.map((ra) => ra.role));
    const role = assigned.find((r) => r.id === stored.roleId);
    if (role) base.role = { id: role.id, name: role.name };
  }

  // Branch / session must belong to the active school.
  if (activeSchoolId && stored?.branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: stored.branchId, schoolId: activeSchoolId },
      select: { id: true, name: true },
    });
    if (branch) base.branch = branch;
  }
  if (activeSchoolId && stored?.academicSessionId) {
    const session = await prisma.academicSession.findFirst({
      where: { id: stored.academicSessionId, schoolId: activeSchoolId },
      select: { id: true, name: true },
    });
    if (session) base.academicSession = session;
  }

  return base;
}
