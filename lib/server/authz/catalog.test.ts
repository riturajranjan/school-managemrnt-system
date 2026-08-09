// RBAC catalog invariants (pure, no DB).
import { describe, expect, it } from "vitest";
import { PERMISSIONS, PERMISSION_KEYS, ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

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
});
