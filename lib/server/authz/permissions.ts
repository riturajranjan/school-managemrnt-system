// Permission resolver (Backend Phase 3). Resolves a user's effective permission
// set SERVER-SIDE from the database: session → user → active role (or the union
// of assigned roles when none is selected yet) → RolePermission → Permission.
// Never trusts anything from the browser. Request-deduped via React cache().
import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/server/auth/current-user";
import type { SafeUser } from "@/lib/server/auth/service";

export type AuthzContext = {
  user: SafeUser;
  isPlatformAdmin: boolean;
  activeRoleKey: string | null;
  permissions: Set<string>;
  schoolId: string | null;
  branchId: string | null;
};

/**
 * Core resolver keyed by userId (no request/cookies) — testable directly.
 * `isPlatformAdmin` only adds the platform permission; tenant permissions always
 * come from the user's real role assignments.
 */
export async function resolveUserAuthz(
  userId: string,
  isPlatformAdmin: boolean,
): Promise<Omit<AuthzContext, "user">> {
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
  // Platform access is a separate boundary — never derived from a tenant role.
  if (isPlatformAdmin) permissions.add("super_admin.access");

  const activeRoleKey = activeRoleId
    ? assignments.find((a) => a.roleId === activeRoleId)?.role.key ?? null
    : null;

  return {
    isPlatformAdmin,
    activeRoleKey,
    permissions,
    schoolId: uac?.schoolId ?? null,
    branchId: uac?.branchId ?? null,
  };
}

/** Resolve the current request's authorization context, or null if unauthenticated. */
export const getAuthzContext = cache(async (): Promise<AuthzContext | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const resolved = await resolveUserAuthz(user.id, user.isPlatformAdmin);
  return { user, ...resolved };
});

/** The current user's effective permission keys (for the capabilities endpoint). */
export async function getCurrentPermissions(): Promise<string[]> {
  const ctx = await getAuthzContext();
  return ctx ? [...ctx.permissions].sort() : [];
}
