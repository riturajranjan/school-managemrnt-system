import "server-only";
import { AuthorizationError } from "./errors";
import { assertPermission, assertPlatformRole, hasPermission, type PlatformRole, type RequestContext } from "./authz";
import { getPlatformRole, requireUser } from "./context";

// ---------------------------------------------------------------------------
// Reusable server guards. Prefer these over scattering `if (role === "ADMIN")`
// checks through pages. Each takes an already-resolved RequestContext (from
// resolveContext) so the DB work happens once per request.
// ---------------------------------------------------------------------------

/** Throws AuthorizationError unless the context holds `permission`. */
export function requirePermission(ctx: RequestContext, permission: string): void {
  assertPermission(ctx, permission);
}

/** Throws unless the context holds at least one of `permissions`. */
export function requireAnyPermission(ctx: RequestContext, permissions: string[]): void {
  if (!permissions.some((p) => hasPermission(ctx, p))) {
    throw new AuthorizationError("You do not have permission to perform this action.", { permissions });
  }
}

/** Throws unless the context's platform role is one of `roles`. */
export function requirePlatformRole(ctx: Pick<RequestContext, "platformRole">, roles: PlatformRole[]): void {
  assertPlatformRole(ctx, roles);
}

// Platform guards frequently run WITHOUT a tenant selection (e.g. the super
// admin control center), so this resolves platform status directly from the
// session rather than requiring a full RequestContext.
export async function requirePlatformAdmin(roles?: PlatformRole[]): Promise<{ userId: string; platformRole: PlatformRole }> {
  const user = await requireUser();
  const platformRole = await getPlatformRole(user.id);
  if (!platformRole) throw new AuthorizationError("Platform administrator access required.");
  if (roles && !roles.includes(platformRole)) {
    throw new AuthorizationError("Insufficient platform role for this action.");
  }
  return { userId: user.id, platformRole };
}
