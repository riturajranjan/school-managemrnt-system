// Reusable server authorization guards for Route Handlers (Backend Phase 3).
// Each guard throws a typed HttpError on failure; wrap a handler body in
// `handle()` to map thrown guards → the standard error envelope + status.
// This keeps every protected endpoint on the same readable pattern and avoids
// duplicating session/permission checks.
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getAuthzContext, type AuthzContext } from "@/lib/server/authz/permissions";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/server/errors";
import { fail, type ApiErrorCode } from "./response";

export class HttpError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const FORBIDDEN_MSG = "You do not have permission to perform this action.";

/** Require a valid session; returns the authz context. Throws UNAUTHENTICATED. */
export async function requireAuth(): Promise<AuthzContext> {
  const ctx = await getAuthzContext();
  if (!ctx) throw new HttpError("UNAUTHENTICATED", "Sign in required");
  return ctx;
}

/** Require a single permission. Throws UNAUTHENTICATED or FORBIDDEN. */
export async function requirePermission(key: string): Promise<AuthzContext> {
  const ctx = await requireAuth();
  if (!ctx.permissions.has(key)) throw new HttpError("FORBIDDEN", FORBIDDEN_MSG);
  return ctx;
}

/** Require at least one of the permissions. */
export async function requireAnyPermission(keys: string[]): Promise<AuthzContext> {
  const ctx = await requireAuth();
  if (!keys.some((k) => ctx.permissions.has(k))) throw new HttpError("FORBIDDEN", FORBIDDEN_MSG);
  return ctx;
}

/** Require all of the permissions. */
export async function requireAllPermissions(keys: string[]): Promise<AuthzContext> {
  const ctx = await requireAuth();
  if (!keys.every((k) => ctx.permissions.has(k))) throw new HttpError("FORBIDDEN", FORBIDDEN_MSG);
  return ctx;
}

/** Require the active role to be one of `roleKeys`. Prefer permissions over this. */
export async function requireRole(...roleKeys: string[]): Promise<AuthzContext> {
  const ctx = await requireAuth();
  if (!ctx.activeRoleKey || !roleKeys.includes(ctx.activeRoleKey)) {
    throw new HttpError("FORBIDDEN", FORBIDDEN_MSG);
  }
  return ctx;
}

/** Require a real platform admin (separate boundary; never a tenant role). */
export async function requirePlatformAdmin(): Promise<AuthzContext> {
  const ctx = await requireAuth();
  if (!ctx.isPlatformAdmin) throw new HttpError("FORBIDDEN", FORBIDDEN_MSG);
  return ctx;
}

/**
 * Require access to a school: it must belong to a tenant the user is a member of.
 * Ownership is validated against real membership — never a client-supplied tenantId.
 */
export async function requireSchoolAccess(ctx: AuthzContext, schoolId: string): Promise<void> {
  const tenantIds = (
    await prisma.tenantMembership.findMany({
      where: { userId: ctx.user.id, status: "ACTIVE" },
      select: { tenantId: true },
    })
  ).map((m) => m.tenantId);
  const school = await prisma.school.findFirst({
    where: { id: schoolId, tenantId: { in: tenantIds.length ? tenantIds : ["__none__"] } },
    select: { id: true },
  });
  if (!school) throw new HttpError("INVALID_SCHOOL", "School not found or not accessible");
}

/** Require access to a branch: it must belong to an accessible school. */
export async function requireBranchAccess(ctx: AuthzContext, branchId: string): Promise<void> {
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { schoolId: true } });
  if (!branch) throw new HttpError("INVALID_BRANCH", "Branch not found");
  await requireSchoolAccess(ctx, branch.schoolId);
}

/** Wrap a handler body: run it, mapping thrown guards → the standard error envelope. */
export async function handle(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof HttpError) return fail(error.code, error.message);
    // Typed application errors from the service/validation layer.
    if (error instanceof ValidationError) return fail("VALIDATION_ERROR", error.message);
    if (error instanceof NotFoundError) return fail("NOT_FOUND", error.message);
    if (error instanceof ConflictError) return fail("CONFLICT", error.message);
    // Never leak raw Prisma errors.
    console.error("[api] unexpected error");
    return fail("SERVER_ERROR", "Something went wrong");
  }
}
