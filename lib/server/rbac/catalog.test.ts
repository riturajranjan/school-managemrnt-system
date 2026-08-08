import { describe, expect, it } from "vitest";
import { PERMISSIONS, SYSTEM_ROLES, isKnownPermission } from "./catalog";

describe("permission catalog", () => {
  it("has unique permission keys", () => {
    const keys = PERMISSIONS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("recognizes catalog keys and rejects unknown ones", () => {
    expect(isKnownPermission("student.view")).toBe(true);
    expect(isKnownPermission("totally.madeup")).toBe(false);
  });
});

describe("system roles", () => {
  it("has unique role keys and never includes a platform SUPER_ADMIN tenant role", () => {
    const keys = SYSTEM_ROLES.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).not.toContain("SUPER_ADMIN");
  });

  it("every role permission references a real catalog permission", () => {
    for (const role of SYSTEM_ROLES) {
      for (const p of role.permissions) {
        expect(isKnownPermission(p)).toBe(true);
      }
    }
  });

  it("AUDITOR is strictly read-only", () => {
    const auditor = SYSTEM_ROLES.find((r) => r.key === "AUDITOR")!;
    expect(auditor.permissions.length).toBeGreaterThan(0);
    for (const p of auditor.permissions) expect(p.endsWith(".view")).toBe(true);
  });

  it("SCHOOL_ADMIN holds every foundation permission", () => {
    const admin = SYSTEM_ROLES.find((r) => r.key === "SCHOOL_ADMIN")!;
    expect(admin.permissions.length).toBe(PERMISSIONS.length);
  });
});
