// RBAC catalog invariants (pure, no DB).
import { describe, expect, it } from "vitest";
import {
  PERMISSIONS,
  PERMISSION_KEYS,
  PLATFORM_PERMISSION_KEYS,
  PLATFORM_ROLE_PERMISSIONS,
  ROLE_PERMISSIONS,
  buildPlatformPermissionMatrix,
  platformPermissionsForRole,
  resolveUiRole,
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

  it("only SUPER_ADMIN can create/suspend schools (SA-2)", () => {
    expect(platformPermissionsForRole("SUPER_ADMIN")).toContain("platform.schools.create");
    expect(platformPermissionsForRole("SUPER_ADMIN")).toContain("platform.schools.suspend");
    for (const role of ["SUPPORT", "BILLING", "AUDITOR"]) {
      expect(platformPermissionsForRole(role)).not.toContain("platform.schools.create");
      expect(platformPermissionsForRole(role)).not.toContain("platform.schools.suspend");
    }
    // Support/billing can still view the directory.
    expect(platformPermissionsForRole("SUPPORT")).toContain("platform.schools.view");
    expect(platformPermissionsForRole("BILLING")).toContain("platform.schools.view");
  });

  it("scopes onboarding management to SUPER_ADMIN and SUPPORT (SA-3)", () => {
    for (const role of ["SUPER_ADMIN", "SUPPORT"]) {
      expect(platformPermissionsForRole(role)).toContain("platform.onboarding.manage");
    }
    // AUDITOR is read-only; BILLING is revenue-only — neither manages onboarding.
    expect(platformPermissionsForRole("AUDITOR")).not.toContain("platform.onboarding.manage");
    expect(platformPermissionsForRole("BILLING")).not.toContain("platform.onboarding.manage");
    // A tenant/school role never gets platform onboarding authority.
    for (const keys of Object.values(ROLE_PERMISSIONS)) {
      expect(keys).not.toContain("platform.onboarding.manage");
      expect(keys).not.toContain("platform.onboarding.view");
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

  it("buildPlatformPermissionMatrix reflects the REAL catalog (drives the Permissions page)", () => {
    const m = buildPlatformPermissionMatrix();
    // The four real platform roles, not the old mock UI roles.
    expect(m.roles.map((r) => r.key)).toEqual(["SUPER_ADMIN", "SUPPORT", "BILLING", "AUDITOR"]);
    // Areas come from the real platform.* modules.
    expect(m.areas.some((a) => a.key === "platform.settings")).toBe(true);
    expect(m.areas.some((a) => a.key === "platform.announcements")).toBe(true);
    // Cells derive from PLATFORM_ROLE_PERMISSIONS: SUPER_ADMIN manages settings;
    // AUDITOR only views it; SUPPORT has neither settings key → null.
    expect(m.matrix.SUPER_ADMIN["platform.settings"]).toBe("manage");
    expect(m.matrix.AUDITOR["platform.settings"]).toBe("view");
    expect(m.matrix.SUPPORT["platform.settings"]).toBeNull();
    expect(m.matrix.SUPER_ADMIN["platform.announcements"]).toBe("manage");
  });

  // --- resolveUiRole (production login/role-resolution audit) --------------

  it("platform admin ALWAYS resolves to super-admin, even with a leftover/assigned tenant role", () => {
    // The exact production bug shape: an account that is a real PlatformAdmin
    // must never fall through to a tenant role — not even one it happens to
    // still carry an assignment for (e.g. from before it was made a platform
    // admin, or a stale UserActiveContext selection).
    expect(
      resolveUiRole({ isPlatformAdmin: true, activeRoleKey: null, assignedRoleKeys: [] }),
    ).toBe("super-admin");
    expect(
      resolveUiRole({ isPlatformAdmin: true, activeRoleKey: "TEACHER", assignedRoleKeys: ["TEACHER"] }),
    ).toBe("super-admin");
    expect(
      resolveUiRole({ isPlatformAdmin: true, activeRoleKey: null, assignedRoleKeys: ["STAFF", "TEACHER"] }),
    ).toBe("super-admin");
  });

  it("a non-platform-admin resolves to their real active/assigned tenant role", () => {
    expect(resolveUiRole({ isPlatformAdmin: false, activeRoleKey: "TEACHER", assignedRoleKeys: ["TEACHER"] })).toBe("teacher");
    expect(resolveUiRole({ isPlatformAdmin: false, activeRoleKey: "SCHOOL_ADMIN", assignedRoleKeys: ["SCHOOL_ADMIN"] })).toBe(
      "administrator",
    );
    expect(resolveUiRole({ isPlatformAdmin: false, activeRoleKey: "STUDENT", assignedRoleKeys: ["STUDENT"] })).toBe("student");
    expect(resolveUiRole({ isPlatformAdmin: false, activeRoleKey: "GUARDIAN", assignedRoleKeys: ["GUARDIAN"] })).toBe("parent");
  });

  it("falls back to the sole assigned role only when no active role is selected", () => {
    expect(resolveUiRole({ isPlatformAdmin: false, activeRoleKey: null, assignedRoleKeys: ["LIBRARIAN"] })).toBe("librarian");
    // Ambiguous (multiple assigned, none selected) → null, never a guess.
    expect(resolveUiRole({ isPlatformAdmin: false, activeRoleKey: null, assignedRoleKeys: ["TEACHER", "STAFF"] })).toBeNull();
    expect(resolveUiRole({ isPlatformAdmin: false, activeRoleKey: null, assignedRoleKeys: [] })).toBeNull();
  });
});
