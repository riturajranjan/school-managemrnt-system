import { getAuthzContext } from "@/lib/server/authz/permissions";
import { getAssignedRoles } from "@/lib/server/context/service";
import { DB_ROLE_TO_UI, PERMISSION_KEYS, resolveUiRole } from "@/lib/server/authz/catalog";
import { getActiveImpersonation } from "@/lib/server/platform/impersonation-service";
import { fail, ok } from "@/lib/server/api/response";

// GET /api/auth/capabilities — the current user's real permission keys, active
// role, and assigned roles, for UI rendering ONLY. Server APIs enforce
// permissions independently (UI hiding is not security).
export async function GET() {
  const ctx = await getAuthzContext();
  if (!ctx) return fail("UNAUTHENTICATED", "Sign in required");

  // Impersonation state (SA-4K) so the client can render the app-wide read-only
  // banner + gate write actions. This is a UI convenience — the server enforces
  // read-only independently (the permission set carries no tenant writes).
  const impersonation = await getActiveImpersonation(ctx.sessionId);

  const assigned = await getAssignedRoles(ctx.user.id);
  const uiRole = resolveUiRole({
    isPlatformAdmin: ctx.isPlatformAdmin,
    activeRoleKey: ctx.activeRoleKey,
    assignedRoleKeys: assigned.map((r) => r.key),
  });

  return ok({
    permissions: [...ctx.permissions].sort(),
    // The full catalog of DB-managed permission keys, so the client knows which
    // permission checks are backed by real server permissions (authoritative)
    // vs. fine-grained UI-only keys not yet modelled in the catalog.
    managedPermissionKeys: PERMISSION_KEYS,
    activeRole: ctx.activeRoleKey,
    uiRole,
    isPlatformAdmin: ctx.isPlatformAdmin,
    assignedRoles: assigned.map((r) => ({ id: r.id, key: r.key, name: r.name, uiRole: DB_ROLE_TO_UI[r.key] ?? null })),
    impersonation,
  });
}
