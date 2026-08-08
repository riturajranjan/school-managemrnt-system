import { describe, expect, it } from "vitest";
import {
  assertPermission,
  assertPlatformRole,
  assertSchoolAccess,
  canAccessBranch,
  canAccessSchool,
  hasAnyPermission,
  hasPermission,
  hasPlatformRole,
  isPlatformAdmin,
  type AccessScope,
  type RequestContext,
} from "./authz";
import { AuthorizationError } from "./errors";
import { SYSTEM_ROLES } from "./rbac/catalog";

// Build a RequestContext from system-role keys using the real catalog, so these
// tests exercise the actual seeded permission mappings.
function ctxFromRoles(roleKeys: string[], scopes: AccessScope[], platformRole: RequestContext["platformRole"] = null): RequestContext {
  const permissions = new Set<string>();
  for (const key of roleKeys) {
    const role = SYSTEM_ROLES.find((r) => r.key === key);
    if (role) role.permissions.forEach((p) => permissions.add(p));
  }
  return {
    userId: "u1",
    tenantId: "t1",
    membershipId: "m1",
    roleKeys,
    permissions,
    scopes,
    platformRole,
  };
}

describe("permission checks", () => {
  it("grants permissions the role has and denies others", () => {
    const ctx = ctxFromRoles(["TEACHER"], [{ type: "ALL_TENANT" }]);
    expect(hasPermission(ctx, "attendance.mark")).toBe(true);
    expect(hasPermission(ctx, "fees.collect")).toBe(false);
  });

  it("hasAnyPermission is true if any is present", () => {
    const ctx = ctxFromRoles(["ACCOUNTANT"], [{ type: "ALL_TENANT" }]);
    expect(hasAnyPermission(ctx, ["fees.collect", "result.publish"])).toBe(true);
    expect(hasAnyPermission(ctx, ["result.publish", "exam.manage"])).toBe(false);
  });

  it("assertPermission throws AuthorizationError when missing", () => {
    const ctx = ctxFromRoles(["STUDENT"], [{ type: "OWN" }]);
    expect(() => assertPermission(ctx, "student.view")).not.toThrow();
    expect(() => assertPermission(ctx, "fees.refund")).toThrow(AuthorizationError);
  });

  it("auditor is strictly read-only", () => {
    const ctx = ctxFromRoles(["AUDITOR"], [{ type: "ALL_TENANT" }]);
    for (const p of ctx.permissions) expect(p.endsWith(".view")).toBe(true);
    expect(hasPermission(ctx, "fees.collect")).toBe(false);
    expect(hasPermission(ctx, "student.view")).toBe(true);
  });
});

describe("school scope", () => {
  it("ALL_TENANT scope can access any school", () => {
    const ctx = ctxFromRoles(["SCHOOL_ADMIN"], [{ type: "ALL_TENANT" }]);
    expect(canAccessSchool(ctx, "any-school")).toBe(true);
  });

  it("SCHOOLS scope only matches its school", () => {
    const ctx = ctxFromRoles(["PRINCIPAL"], [{ type: "SCHOOLS", schoolId: "sch-a" }]);
    expect(canAccessSchool(ctx, "sch-a")).toBe(true);
    expect(canAccessSchool(ctx, "sch-b")).toBe(false);
    expect(() => assertSchoolAccess(ctx, "sch-b")).toThrow(AuthorizationError);
  });

  it("BRANCHES scope grants access to the branch's owning school", () => {
    const ctx = ctxFromRoles(["TEACHER"], [{ type: "BRANCHES", schoolId: "sch-a", branchId: "br-1" }]);
    expect(canAccessSchool(ctx, "sch-a")).toBe(true);
    expect(canAccessSchool(ctx, "sch-b")).toBe(false);
  });
});

describe("branch scope", () => {
  it("SCHOOLS scope authorizes any branch under that school", () => {
    const ctx = ctxFromRoles(["PRINCIPAL"], [{ type: "SCHOOLS", schoolId: "sch-a" }]);
    expect(canAccessBranch(ctx, "br-1", "sch-a")).toBe(true);
    expect(canAccessBranch(ctx, "br-9", "sch-b")).toBe(false);
  });

  it("BRANCHES scope authorizes only the assigned branch", () => {
    const ctx = ctxFromRoles(["TEACHER"], [{ type: "BRANCHES", schoolId: "sch-a", branchId: "br-1" }]);
    expect(canAccessBranch(ctx, "br-1", "sch-a")).toBe(true);
    expect(canAccessBranch(ctx, "br-2", "sch-a")).toBe(false);
  });
});

describe("platform role separation", () => {
  it("tenant users are not platform admins", () => {
    const ctx = ctxFromRoles(["SCHOOL_ADMIN"], [{ type: "ALL_TENANT" }]);
    expect(isPlatformAdmin(ctx)).toBe(false);
    expect(hasPlatformRole(ctx, ["SUPER_ADMIN"])).toBe(false);
    expect(() => assertPlatformRole(ctx, ["SUPER_ADMIN"])).toThrow(AuthorizationError);
  });

  it("platform staff pass platform-role checks", () => {
    const ctx = ctxFromRoles([], [], "SUPER_ADMIN");
    expect(isPlatformAdmin(ctx)).toBe(true);
    expect(hasPlatformRole(ctx, ["SUPER_ADMIN", "PLATFORM_OWNER"])).toBe(true);
    expect(hasPlatformRole(ctx, ["BILLING_ADMIN"])).toBe(false);
    expect(() => assertPlatformRole(ctx, ["SUPER_ADMIN"])).not.toThrow();
  });
});
