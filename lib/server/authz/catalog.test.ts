// RBAC catalog invariants (pure, no DB).
import { describe, expect, it } from "vitest";
import {
  PERMISSIONS,
  PERMISSION_KEYS,
  PLATFORM_PERMISSION_KEYS,
  PLATFORM_ROLE_PERMISSIONS,
  ROLE_PERMISSIONS,
  platformPermissionsForRole,
} from "@/lib/server/authz/catalog";

describe("RBAC catalog", () => {
  it("has unique, well-formed permission keys (module.action)", () => {
    expect(new Set(PERMISSION_KEYS).size).toBe(PERMISSION_KEYS.length);
    for (const p of PERMISSIONS) {
      expect(p.key).toBe(`${p.module}.${p.action}`);
    }
  });

  it("maps only real permission keys to roles", () => {
    for (const keys of Object.values(ROLE_PERMISSIONS)) {
      for (const k of keys) expect(PERMISSION_KEYS).toContain(k);
    }
  });

  it("NEVER grants platform access (super_admin.access) to any tenant role", () => {
    for (const keys of Object.values(ROLE_PERMISSIONS)) {
      expect(keys).not.toContain("super_admin.access");
    }
  });

  it("gives no role a wildcard (every role is a strict subset of the catalog)", () => {
    for (const keys of Object.values(ROLE_PERMISSIONS)) {
      expect(keys.length).toBeLessThan(PERMISSION_KEYS.length);
    }
  });

  it("TEACHER lacks settings/fees management; SCHOOL_ADMIN has them", () => {
    expect(ROLE_PERMISSIONS.TEACHER).not.toContain("settings.view");
    expect(ROLE_PERMISSIONS.TEACHER).not.toContain("fees.collect");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("settings.manage");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("fees.collect");
  });

  it("scopes guardian permissions: SCHOOL_ADMIN manages, TEACHER only views", () => {
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("guardians.create");
    expect(ROLE_PERMISSIONS.SCHOOL_ADMIN).toContain("guardians.update");
    expect(ROLE_PERMISSIONS.TEACHER).toContain("guardians.view");
    expect(ROLE_PERMISSIONS.TEACHER).not.toContain("guardians.create");
    expect(ROLE_PERMISSIONS.TEACHER).not.toContain("guardians.update");
  });

  // --- Platform (Super Admin SA-1) namespace separation --------------------

  it("platform-role maps reference only real platform permission keys", () => {
    for (const keys of Object.values(PLATFORM_ROLE_PERMISSIONS)) {
      for (const k of keys) expect(PLATFORM_PERMISSION_KEYS).toContain(k);
    }
  });

  it("keeps platform and tenant permission domains disjoint", () => {
    const tenantKeys = new Set(Object.values(ROLE_PERMISSIONS).flat());
    // No tenant role may grant a platform.* key or the super_admin gate.
    for (const k of tenantKeys) {
      expect(k.startsWith("platform.")).toBe(false);
      expect(k).not.toBe("super_admin.access");
    }
    // No platform role may grant a tenant permission key.
    const platformKeySet = new Set(PLATFORM_PERMISSION_KEYS);
    for (const keys of Object.values(PLATFORM_ROLE_PERMISSIONS)) {
      for (const k of keys) expect(platformKeySet.has(k)).toBe(true);
    }
  });

  it("platformPermissionsForRole always includes the gate; unknown role → gate only", () => {
    expect(platformPermissionsForRole("SUPER_ADMIN")).toContain("super_admin.access");
    expect(platformPermissionsForRole("SUPER_ADMIN")).toContain("platform.schools.create");
    expect(platformPermissionsForRole("AUDITOR")).toContain("super_admin.access");
    // AUDITOR is read-only — no manage/create/suspend keys.
    expect(platformPermissionsForRole("AUDITOR").some((k) => /\.(manage|create|update|suspend)$/.test(k))).toBe(false);
    expect(platformPermissionsForRole(null)).toEqual(["super_admin.access"]);
    expect(platformPermissionsForRole("NOT_A_ROLE")).toEqual(["super_admin.access"]);
  });
});
