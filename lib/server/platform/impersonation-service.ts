// Server-authoritative platform impersonation (Super Admin Phase SA-4K).
//
// SECURITY MODEL (V1 = READ-ONLY SCHOOL INSPECTION):
//   • The authority is the `PlatformImpersonation` row, bound 1:1 to an auth
//     Session (sessionId @unique). Nothing the browser stores (localStorage /
//     sessionStorage / cookies / React state) can start, extend, or fake it.
//   • The ACTOR is always the platform admin; impersonation never changes their
//     identity. The TARGET tenant is DERIVED from the target School here — the
//     caller supplies only a schoolId, never a tenantId/roleId/permissionIds.
//   • The authz layer (getAuthzContext) grants the actor only tenant `.view`
//     inspection permissions for the target while a row is active — never a
//     tenant role, never writes. See lib/server/authz/permissions.ts.
//   • FK cascade to Session means logout / session teardown removes the row; an
//     expired session never resolves a user, so the row can never authorize
//     independently.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { INSPECTABLE_STATUSES } from "@/lib/server/auth/impersonation";
import type { OrgScope } from "@/lib/server/api/scope";

// Re-exported so callers that already import the service keep one entry point.
export { resolveActiveTarget } from "@/lib/server/auth/impersonation";

export type ImpersonationActor = { id: string; name: string | null };

/** Safe, client-facing impersonation state (never exposes the session token). */
export type ImpersonationState =
  | { active: false }
  | {
      active: true;
      school: { id: string; name: string };
      tenant: { id: string; name: string };
      startedAt: string;
      /** V1 policy marker — the UI renders a read-only banner from this. */
      readOnly: true;
    };

function auditScope(actor: ImpersonationActor, targetTenantId: string, targetSchoolId: string): OrgScope {
  return {
    tenantId: targetTenantId,
    schoolId: targetSchoolId,
    branchId: null,
    academicSessionId: null,
    actor: { id: actor.id, name: actor.name },
  };
}

/** Full safe state for the GET endpoint / capabilities (with target names). */
export async function getActiveImpersonation(sessionId: string): Promise<ImpersonationState> {
  const row = await prisma.platformImpersonation.findUnique({
    where: { sessionId },
    select: { targetTenantId: true, targetSchoolId: true, startedAt: true },
  });
  if (!row) return { active: false };
  const school = await prisma.school.findFirst({
    where: { id: row.targetSchoolId, tenantId: row.targetTenantId },
    select: { id: true, name: true, status: true, tenant: { select: { id: true, name: true } } },
  });
  // Target vanished/archived → present as inactive (the row is stale; a stop or
  // logout will clear it, and the authz resolver already fails closed).
  if (!school || !INSPECTABLE_STATUSES.has(school.status)) return { active: false };
  return {
    active: true,
    school: { id: school.id, name: school.name },
    tenant: { id: school.tenant.id, name: school.tenant.name },
    startedAt: row.startedAt.toISOString(),
    readOnly: true,
  };
}

/**
 * Start read-only impersonation of a school for the current session. The caller
 * must already be authorized (platform.impersonation.manage) at the route. One
 * active impersonation per session — an existing one must be stopped first
 * (explicit stop → start; no silent target switch, and no nesting).
 */
export async function startImpersonation(args: {
  sessionId: string;
  actor: ImpersonationActor;
  schoolId: string;
}): Promise<ImpersonationState> {
  const { sessionId, actor, schoolId } = args;

  const existing = await prisma.platformImpersonation.findUnique({
    where: { sessionId },
    select: { id: true },
  });
  if (existing) {
    throw new HttpError("IMPERSONATION_ACTIVE", "Already impersonating — stop the current session first");
  }

  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { id: true, name: true, status: true, tenantId: true, tenant: { select: { id: true, name: true } } },
  });
  if (!school) throw new HttpError("NOT_FOUND", "School not found");
  if (!INSPECTABLE_STATUSES.has(school.status)) {
    throw new HttpError("IMPERSONATION_TARGET_INELIGIBLE", "This school cannot be inspected (archived)");
  }

  await prisma.$transaction(async (tx) => {
    await tx.platformImpersonation.create({
      data: {
        sessionId,
        platformUserId: actor.id,
        targetTenantId: school.tenantId,
        targetSchoolId: school.id,
      },
    });
    await recordAudit(
      tx,
      auditScope(actor, school.tenantId, school.id),
      "IMPERSONATION_STARTED",
      "School",
      school.id,
      { schoolName: school.name, mode: "READ_ONLY" },
    );
  });

  return {
    active: true,
    school: { id: school.id, name: school.name },
    tenant: { id: school.tenant.id, name: school.tenant.name },
    startedAt: new Date().toISOString(),
    readOnly: true,
  };
}

/**
 * Stop impersonation for the current session. Idempotent — if nothing is active
 * it simply reports inactive. Deletes the row and writes an IMPERSONATION_ENDED
 * audit against the target.
 */
export async function stopImpersonation(args: {
  sessionId: string;
  actor: ImpersonationActor;
}): Promise<ImpersonationState> {
  const { sessionId, actor } = args;
  const row = await prisma.platformImpersonation.findUnique({
    where: { sessionId },
    select: { id: true, targetTenantId: true, targetSchoolId: true },
  });
  if (!row) return { active: false };

  await prisma.$transaction(async (tx) => {
    // Delete by unique id, but guard on sessionId so a concurrent stop is a no-op.
    await tx.platformImpersonation.deleteMany({ where: { id: row.id, sessionId } });
    await recordAudit(
      tx,
      auditScope(actor, row.targetTenantId, row.targetSchoolId),
      "IMPERSONATION_ENDED",
      "School",
      row.targetSchoolId,
    );
  });

  return { active: false };
}
