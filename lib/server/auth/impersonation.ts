// Impersonation DAL — the guard-free resolver the authorization layer calls to
// learn the CURRENT read-only inspection target for a session (Super Admin
// SA-4K). Kept dependency-light (prisma only) so lib/server/authz can import it
// without a cycle through the route-guard layer. The mutating start/stop flow
// lives in lib/server/platform/impersonation-service.ts (which reuses this).
import { prisma } from "@/lib/db/prisma";

// School statuses a platform admin may inspect. ARCHIVED is intentionally
// excluded (fail closed) — a removed school is not an inspection target in V1.
export const INSPECTABLE_STATUSES = new Set(["ACTIVE", "SETUP_PENDING", "SUSPENDED"]);

/**
 * The current impersonation target for a session, or null. Re-validates that the
 * target school still exists, still belongs to the recorded tenant, and is still
 * inspectable — so a school deleted/archived mid-session collapses the context
 * to plain platform mode (fail closed). Returns only ids (no names/token).
 */
export async function resolveActiveTarget(
  sessionId: string,
): Promise<{ targetTenantId: string; targetSchoolId: string } | null> {
  const row = await prisma.platformImpersonation.findUnique({
    where: { sessionId },
    select: { targetTenantId: true, targetSchoolId: true },
  });
  if (!row) return null;
  const school = await prisma.school.findFirst({
    where: { id: row.targetSchoolId, tenantId: row.targetTenantId },
    select: { status: true },
  });
  if (!school || !INSPECTABLE_STATUSES.has(school.status)) return null;
  return { targetTenantId: row.targetTenantId, targetSchoolId: row.targetSchoolId };
}
