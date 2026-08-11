// Phase-4 org-scope resolver. Turns the request's AuthzContext into a validated
// business scope { tenantId, schoolId, branchId, academicSessionId }. Every id is
// re-validated against the user's REAL membership/school here (never trusted from
// the browser), and a stale/foreign id fails closed. Business services take an
// OrgScope and always constrain Prisma queries by tenantId + schoolId.
import { prisma } from "@/lib/db/prisma";
import type { AuthzContext } from "@/lib/server/authz/permissions";
import { HttpError } from "./guard";

export type OrgScope = {
  tenantId: string;
  schoolId: string;
  branchId: string | null;
  academicSessionId: string | null;
  actor: { id: string; name: string | null };
};

/** Tenant ids of the user's ACTIVE memberships (the only tenants they may touch). */
async function accessibleTenantIds(userId: string): Promise<string[]> {
  const rows = await prisma.tenantMembership.findMany({
    where: { userId, status: "ACTIVE" },
    select: { tenantId: true },
  });
  return rows.map((r) => r.tenantId);
}

/**
 * Resolve + validate the active org scope. A school MUST be selected. The stored
 * branch/session are only kept if they still belong to the active school.
 */
export async function requireOrgScope(ctx: AuthzContext): Promise<OrgScope> {
  // Impersonation (SA-4K): the target tenant/school is server-authoritative
  // (recorded at start, re-validated by the authz resolver) — NOT the actor's
  // membership. Read-only inspection needs no branch/session selection. Writes
  // are already blocked upstream: the impersonation permission set contains no
  // tenant write permission, so requirePermission fails before a write route
  // ever reaches here.
  if (ctx.impersonation) {
    const { targetTenantId, targetSchoolId } = ctx.impersonation;
    const school = await prisma.school.findFirst({
      where: { id: targetSchoolId, tenantId: targetTenantId },
      select: { id: true },
    });
    if (!school) throw new HttpError("INVALID_SCHOOL", "Impersonation target is no longer available");
    return {
      tenantId: targetTenantId,
      schoolId: targetSchoolId,
      branchId: null,
      academicSessionId: null,
      actor: { id: ctx.user.id, name: ctx.user.name ?? null },
    };
  }

  if (!ctx.schoolId) throw new HttpError("INVALID_SCHOOL", "No school selected");

  const tenantIds = await accessibleTenantIds(ctx.user.id);
  const school = await prisma.school.findFirst({
    where: { id: ctx.schoolId, tenantId: { in: tenantIds.length ? tenantIds : ["__none__"] } },
    select: { tenantId: true },
  });
  if (!school) throw new HttpError("INVALID_SCHOOL", "School not found or not accessible");

  const uac = await prisma.userActiveContext.findUnique({
    where: { userId: ctx.user.id },
    select: { academicSessionId: true },
  });

  let academicSessionId: string | null = null;
  if (uac?.academicSessionId) {
    const session = await prisma.academicSession.findFirst({
      where: { id: uac.academicSessionId, schoolId: ctx.schoolId },
      select: { id: true },
    });
    academicSessionId = session?.id ?? null;
  }

  let branchId: string | null = null;
  if (ctx.branchId) {
    const branch = await prisma.branch.findFirst({
      where: { id: ctx.branchId, schoolId: ctx.schoolId },
      select: { id: true },
    });
    branchId = branch?.id ?? null;
  }

  return {
    tenantId: school.tenantId,
    schoolId: ctx.schoolId,
    branchId,
    academicSessionId,
    actor: { id: ctx.user.id, name: ctx.user.name ?? null },
  };
}

/** Validate that an explicit branchId belongs to the scoped school. Returns it. */
export async function assertBranchInScope(scope: OrgScope, branchId: string): Promise<string> {
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, schoolId: scope.schoolId },
    select: { id: true },
  });
  if (!branch) throw new HttpError("INVALID_BRANCH", "Branch not found in the selected school");
  return branch.id;
}

/** Validate that an explicit academicSessionId belongs to the scoped school. Returns it. */
export async function assertSessionInScope(scope: OrgScope, academicSessionId: string): Promise<string> {
  const session = await prisma.academicSession.findFirst({
    where: { id: academicSessionId, schoolId: scope.schoolId },
    select: { id: true },
  });
  if (!session) throw new HttpError("INVALID_SESSION", "Academic session not found in the selected school");
  return session.id;
}

/**
 * Resolve the branch to use for a create: an explicit (validated) branchId wins,
 * else the active context branch, else — if the school has exactly one branch —
 * that one. Throws INVALID_BRANCH when it cannot be determined unambiguously.
 */
export async function resolveCreateBranch(scope: OrgScope, explicitBranchId?: string): Promise<string> {
  if (explicitBranchId) return assertBranchInScope(scope, explicitBranchId);
  if (scope.branchId) return scope.branchId;
  // Fall back to the school's single ACTIVE branch (a setup-pending/inactive
  // branch is not a valid enrolment target).
  const active = await prisma.branch.findMany({
    where: { schoolId: scope.schoolId, status: "ACTIVE" },
    select: { id: true },
  });
  if (active.length === 1) return active[0].id;
  throw new HttpError("INVALID_BRANCH", "Select a branch for this record");
}

/**
 * Resolve the academic session for a create: explicit (validated) wins, else the
 * active context session, else the school's single current/only session.
 */
export async function resolveCreateSession(scope: OrgScope, explicitSessionId?: string): Promise<string> {
  if (explicitSessionId) return assertSessionInScope(scope, explicitSessionId);
  if (scope.academicSessionId) return scope.academicSessionId;
  const sessions = await prisma.academicSession.findMany({
    where: { schoolId: scope.schoolId, status: { not: "ARCHIVED" } },
    select: { id: true, isCurrent: true },
  });
  const current = sessions.filter((s) => s.isCurrent);
  if (current.length === 1) return current[0].id;
  if (sessions.length === 1) return sessions[0].id;
  throw new HttpError("INVALID_SESSION", "Select an academic session for this record");
}
