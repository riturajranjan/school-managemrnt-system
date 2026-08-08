import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { AuthenticationError, AuthorizationError } from "./errors";
import { assertBranchAccess, assertSchoolAccess, type AccessScope, type PlatformRole, type RequestContext } from "./authz";

// ---------------------------------------------------------------------------
// Server context resolution. Turns a Better Auth session + a (client-supplied
// but server-validated) tenant/school/branch selection into a trusted
// RequestContext. This is the ONLY place client-provided tenant/school/branch
// ids are checked against real membership — never trust them elsewhere.
// ---------------------------------------------------------------------------

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  status: string;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, image: true, status: true },
  });
  if (!user || user.status !== "ACTIVE") return null;
  return user;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthenticationError();
  return user;
}

// Tenant/school/branch/session selection. Values originate from the client
// (cookie/localStorage preference) but are validated here against membership.
export type ContextSelector = {
  tenantId: string;
  schoolId?: string;
  branchId?: string;
  academicSessionId?: string;
};

export async function getPlatformRole(userId: string): Promise<PlatformRole | null> {
  const admin = await prisma.platformAdmin.findUnique({ where: { userId } });
  if (!admin || admin.status !== "ACTIVE") return null;
  return admin.role as PlatformRole;
}

// Resolves the full trusted context for a signed-in user + selection.
// Throws AuthenticationError if not signed in, AuthorizationError if the user
// is not an active member of the tenant or lacks access to the selection.
export async function resolveContext(selector: ContextSelector): Promise<RequestContext> {
  const user = await requireUser();

  const membership = await prisma.tenantMembership.findUnique({
    where: { userId_tenantId: { userId: user.id, tenantId: selector.tenantId } },
    include: {
      roleAssignments: {
        include: { role: { include: { permissions: { include: { permission: true } } } } },
      },
    },
  });

  if (!membership || membership.status !== "ACTIVE") {
    // Do not reveal whether the tenant exists — just deny.
    throw new AuthorizationError("You do not have access to this workspace.");
  }

  const roleKeys: string[] = [];
  const permissions = new Set<string>();
  const scopes: AccessScope[] = [];

  for (const ra of membership.roleAssignments) {
    roleKeys.push(ra.role.key);
    for (const rp of ra.role.permissions) permissions.add(rp.permission.key);
    scopes.push({ type: ra.scopeType as AccessScope["type"], schoolId: ra.schoolId, branchId: ra.branchId });
  }

  // Enrich BRANCHES scopes that lack a schoolId so school-level checks work.
  const branchIdsNeedingSchool = scopes
    .filter((s) => s.type === "BRANCHES" && s.branchId && !s.schoolId)
    .map((s) => s.branchId as string);
  if (branchIdsNeedingSchool.length > 0) {
    const branches = await prisma.branch.findMany({
      where: { id: { in: branchIdsNeedingSchool } },
      select: { id: true, schoolId: true },
    });
    const schoolByBranch = new Map(branches.map((b) => [b.id, b.schoolId]));
    for (const s of scopes) {
      if (s.type === "BRANCHES" && s.branchId && !s.schoolId) {
        s.schoolId = schoolByBranch.get(s.branchId) ?? null;
      }
    }
  }

  const platformRole = await getPlatformRole(user.id);

  const ctx: RequestContext = {
    userId: user.id,
    tenantId: selector.tenantId,
    membershipId: membership.id,
    roleKeys,
    permissions,
    scopes,
    platformRole,
  };

  // Validate the active school/branch selection against the resolved scopes.
  if (selector.schoolId) {
    // Confirm the school belongs to this tenant before scope-checking.
    const school = await prisma.school.findFirst({
      where: { id: selector.schoolId, tenantId: selector.tenantId },
      select: { id: true },
    });
    if (!school) throw new AuthorizationError("Selected school is not part of this workspace.");
    assertSchoolAccess(ctx, selector.schoolId);
    ctx.schoolId = selector.schoolId;
  }

  if (selector.branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: selector.branchId, school: { tenantId: selector.tenantId } },
      select: { id: true, schoolId: true },
    });
    if (!branch) throw new AuthorizationError("Selected branch is not part of this workspace.");
    assertBranchAccess(ctx, branch.id, branch.schoolId);
    ctx.branchId = branch.id;
    if (!ctx.schoolId) ctx.schoolId = branch.schoolId;
  }

  if (selector.academicSessionId) {
    // Session must belong to the selected (or an accessible) school.
    const session = await prisma.academicSession.findFirst({
      where: {
        id: selector.academicSessionId,
        school: { tenantId: selector.tenantId, ...(ctx.schoolId ? { id: ctx.schoolId } : {}) },
      },
      select: { id: true, schoolId: true },
    });
    if (!session) throw new AuthorizationError("Selected academic session is not accessible.");
    assertSchoolAccess(ctx, session.schoolId);
    ctx.academicSessionId = session.id;
  }

  return ctx;
}
