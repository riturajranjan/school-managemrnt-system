import { getAuthzContext } from "@/lib/server/authz/permissions";
import { getAssignedRoles } from "@/lib/server/context/service";
import { DB_ROLE_TO_UI, PLATFORM_UI_ROLE } from "@/lib/server/authz/catalog";
import { fail, ok } from "@/lib/server/api/response";

// GET /api/auth/capabilities — the current user's real permission keys, active
// role, and assigned roles, for UI rendering ONLY. Server APIs enforce
// permissions independently (UI hiding is not security).
export async function GET() {
  const ctx = await getAuthzContext();
  if (!ctx) return fail("UNAUTHENTICATED", "Sign in required");

  const assigned = await getAssignedRoles(ctx.user.id);
  // Effective role for display: the selected active role, else the sole assigned
  // role (the resolver auto-selects a single role at login anyway).
  const effectiveRoleKey = ctx.activeRoleKey ?? (assigned.length === 1 ? assigned[0].key : null);
  const uiRole = ctx.isPlatformAdmin
    ? PLATFORM_UI_ROLE
    : effectiveRoleKey
      ? DB_ROLE_TO_UI[effectiveRoleKey] ?? null
      : null;

  return ok({
    permissions: [...ctx.permissions].sort(),
    activeRole: ctx.activeRoleKey,
    uiRole,
    isPlatformAdmin: ctx.isPlatformAdmin,
    assignedRoles: assigned.map((r) => ({ id: r.id, key: r.key, name: r.name, uiRole: DB_ROLE_TO_UI[r.key] ?? null })),
  });
}
