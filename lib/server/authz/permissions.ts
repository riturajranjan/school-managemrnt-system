// Permission resolver (Backend Phase 3). Resolves a user's effective permission
// set SERVER-SIDE from the database: session → user → active role (or the union
// of assigned roles when none is selected yet) → RolePermission → Permission.
// Never trusts anything from the browser. Request-deduped via React cache().
import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { getCurrentSessionContext } from "@/lib/server/auth/current-user";
import { resolveActiveTarget } from "@/lib/server/auth/impersonation";
import type { SafeUser } from "@/lib/server/auth/service";
import { INSPECTION_PERMISSION_KEYS, platformPermissionsForRole } from "./catalog";

export type AuthzContext = {
  user: SafeUser;
  /** The current auth Session row id — the anchor impersonation binds to. */
  sessionId: string;
  isPlatformAdmin: boolean;
  /** The PlatformAdmin.role (SUPER_ADMIN | SUPPORT | BILLING | AUDITOR) or null. */
  platformRole: string | null;
  activeRoleKey: string | null;
  permissions: Set<string>;
  schoolId: string | null;
  branchId: string | null;
  /**
   * When set, this request is a platform admin READ-ONLY inspecting a school
   * (SA-4K). The actor identity is unchanged; `permissions` has been narrowed to
   * platform perms + tenant `.view` inspection reads, and `schoolId` points at
   * the target. Business scope (requireOrgScope) derives the target tenant/school
   * from this — never from the actor's membership.
   */
  impersonation: { targetTenantId: string; targetSchoolId: string } | null;
};

/**
 * Core resolver keyed by userId (no request/cookies) — testable directly.
 * `isPlatformAdmin` only adds the platform permission; tenant permissions always
 * come from the user's real role assignments.
 */
export async function resolveUserAuthz(
  userId: string,
  isPlatformAdmin: boolean,
): Promise<Omit<AuthzContext, "user" | "sessionId">> {
  const [uac, memberships] = await Promise.all([
    prisma.userActiveContext.findUnique({
      where: { userId },
      select: { roleId: true, schoolId: true, branchId: true },
    }),
    prisma.tenantMembership.findMany({
      where: { userId, status: "ACTIVE" },
      select: { roleAssignments: { select: { roleId: true, role: { select: { key: true } } } } },
    }),
  ]);

  const assignments = memberships.flatMap((m) => m.roleAssignments);
  const assignedRoleIds = assignments.map((a) => a.roleId);
  // Use the selected active role if it's genuinely assigned; else fall back to
  // the union of all assigned roles so a user isn't permission-less pre-selection.
  const activeRoleId = uac?.roleId && assignedRoleIds.includes(uac.roleId) ? uac.roleId : null;
  const effectiveRoleIds = activeRoleId ? [activeRoleId] : assignedRoleIds;

  const rolePerms = effectiveRoleIds.length
    ? await prisma.rolePermission.findMany({
        where: { roleId: { in: effectiveRoleIds } },
        select: { permission: { select: { key: true } } },
      })
    : [];

  const permissions = new Set(rolePerms.map((rp) => rp.permission.key));

  // Platform authorization is a SEPARATE domain — granted only to real platform
  // admins, by their PlatformRole, and never derived from (or mixed with) tenant
  // role permissions. Tenant permissions above come exclusively from real role
  // assignments; we never do `if (isPlatformAdmin) return true`.
  let platformRole: string | null = null;
  if (isPlatformAdmin) {
    const pa = await prisma.platformAdmin.findUnique({ where: { userId }, select: { role: true } });
    platformRole = pa?.role ?? null;
    for (const key of platformPermissionsForRole(platformRole)) permissions.add(key);
  }

  const activeRoleKey = activeRoleId
    ? assignments.find((a) => a.roleId === activeRoleId)?.role.key ?? null
    : null;

  return {
    isPlatformAdmin,
    platformRole,
    activeRoleKey,
    permissions,
    schoolId: uac?.schoolId ?? null,
    branchId: uac?.branchId ?? null,
    impersonation: null,
  };
}

/**
 * Resolve the current request's authorization context, or null if
 * unauthenticated. When the session has an active impersonation AND the actor is
 * a real platform admin, the context is narrowed to READ-ONLY school inspection:
 * the actor keeps their platform permissions (identity + the ability to stop),
 * gains ONLY tenant `.view` inspection reads for the target, and `schoolId` is
 * pointed at the target school. The actor's own tenant role permissions are
 * deliberately dropped — they belong to a different tenant and must never apply
 * to the inspection target. No writes are ever granted (no `.create/.update/…`).
 */
export const getAuthzContext = cache(async (): Promise<AuthzContext | null> => {
  const session = await getCurrentSessionContext();
  if (!session) return null;
  const { sessionId, user } = session;
  const resolved = await resolveUserAuthz(user.id, user.isPlatformAdmin);

  // Impersonation is a platform-admin-only capability; a non-platform session can
  // never carry an active target (defense in depth — the start route also gates).
  const target = user.isPlatformAdmin ? await resolveActiveTarget(sessionId) : null;
  if (target) {
    const permissions = new Set<string>(platformPermissionsForRole(resolved.platformRole));
    for (const key of INSPECTION_PERMISSION_KEYS) permissions.add(key);
    return {
      user,
      sessionId,
      ...resolved,
      permissions,
      schoolId: target.targetSchoolId,
      branchId: null,
      impersonation: { targetTenantId: target.targetTenantId, targetSchoolId: target.targetSchoolId },
    };
  }

  return { user, sessionId, ...resolved };
});

/** The current user's effective permission keys (for the capabilities endpoint). */
export async function getCurrentPermissions(): Promise<string[]> {
  const ctx = await getAuthzContext();
  return ctx ? [...ctx.permissions].sort() : [];
}
