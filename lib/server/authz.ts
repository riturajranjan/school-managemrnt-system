import { AuthorizationError } from "./errors";

// ---------------------------------------------------------------------------
// Pure authorization core. No DB, no auth library, no I/O — every function here
// operates on an already-resolved RequestContext so it is fully unit-testable.
// The DB-backed resolver lives in context.ts and produces these values.
//
// The string unions below MIRROR the Prisma enums in schema.prisma. Kept local
// (not imported from the generated client) so this module stays free of any
// server-only dependency chain and can run in the Vitest node environment.
// ---------------------------------------------------------------------------

export type AccessScopeType =
  | "ALL_TENANT"
  | "SCHOOLS"
  | "BRANCHES"
  | "CLASSES"
  | "SECTIONS"
  | "SUBJECTS"
  | "OWN";

export type PlatformRole =
  | "PLATFORM_OWNER"
  | "SUPER_ADMIN"
  | "BILLING_ADMIN"
  | "SUPPORT_ADMIN"
  | "CUSTOMER_SUCCESS"
  | "AUDITOR";

// A single grant. For BRANCHES scopes we also carry the branch's owning
// schoolId so school-level access can be derived without another lookup.
export type AccessScope = {
  type: AccessScopeType;
  schoolId?: string | null;
  branchId?: string | null;
};

// The validated per-request identity + access envelope. Produced server-side
// from the session + membership; never trusted from client input.
export type RequestContext = {
  userId: string;
  tenantId: string;
  membershipId: string;
  // Active selection (validated against scopes when set).
  schoolId?: string;
  branchId?: string;
  academicSessionId?: string;
  roleKeys: string[];
  permissions: ReadonlySet<string>;
  scopes: AccessScope[];
  // Present only for platform staff (out-of-band from tenant membership).
  platformRole?: PlatformRole | null;
};

// --- Permission checks -----------------------------------------------------

export function hasPermission(ctx: RequestContext, permission: string): boolean {
  return ctx.permissions.has(permission);
}

export function hasAnyPermission(ctx: RequestContext, permissions: string[]): boolean {
  return permissions.some((p) => ctx.permissions.has(p));
}

export function hasAllPermissions(ctx: RequestContext, permissions: string[]): boolean {
  return permissions.every((p) => ctx.permissions.has(p));
}

export function assertPermission(ctx: RequestContext, permission: string): void {
  if (!hasPermission(ctx, permission)) {
    throw new AuthorizationError("You do not have permission to perform this action.", { permission });
  }
}

// --- Scope checks ----------------------------------------------------------

export function canAccessSchool(ctx: RequestContext, schoolId: string): boolean {
  return ctx.scopes.some((s) => {
    if (s.type === "ALL_TENANT") return true;
    if (s.type === "SCHOOLS") return s.schoolId === schoolId;
    if (s.type === "BRANCHES") return s.schoolId === schoolId;
    return false;
  });
}

// Branch access needs the branch's owning school so a SCHOOLS-scoped grant can
// authorize any branch under that school.
export function canAccessBranch(ctx: RequestContext, branchId: string, branchSchoolId: string): boolean {
  return ctx.scopes.some((s) => {
    if (s.type === "ALL_TENANT") return true;
    if (s.type === "SCHOOLS") return s.schoolId === branchSchoolId;
    if (s.type === "BRANCHES") return s.branchId === branchId;
    return false;
  });
}

export function assertSchoolAccess(ctx: RequestContext, schoolId: string): void {
  if (!canAccessSchool(ctx, schoolId)) {
    throw new AuthorizationError("You do not have access to this school.", { schoolId });
  }
}

export function assertBranchAccess(ctx: RequestContext, branchId: string, branchSchoolId: string): void {
  if (!canAccessBranch(ctx, branchId, branchSchoolId)) {
    throw new AuthorizationError("You do not have access to this branch.", { branchId });
  }
}

// --- Platform checks -------------------------------------------------------

export function isPlatformAdmin(ctx: Pick<RequestContext, "platformRole">): boolean {
  return ctx.platformRole != null;
}

export function hasPlatformRole(ctx: Pick<RequestContext, "platformRole">, roles: PlatformRole[]): boolean {
  return ctx.platformRole != null && roles.includes(ctx.platformRole);
}

export function assertPlatformRole(ctx: Pick<RequestContext, "platformRole">, roles: PlatformRole[]): void {
  if (!hasPlatformRole(ctx, roles)) {
    throw new AuthorizationError("Platform administrator access required.");
  }
}
