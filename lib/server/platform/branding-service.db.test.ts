// School branding DB-integration tests (Super Admin SA-4L). Exercises the real
// branding-service against Postgres: null defaults, save + persistence, partial
// update + clear, color (#RRGGBB) and URL validation, tenant-derived-from-school,
// and RBAC. Namespaced ("T4LBRAND-").
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { getBranding, updateBranding } from "@/lib/server/platform/branding-service";
import { platformPermissionsForRole, ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T4LBRAND";
const stamp = Date.now().toString(36);
const actor = { id: "t4lbrand-actor", name: "T4LBRAND Tester" };
let tenantId = "";
let schoolId = "";

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} Tenant`, slug: `t4lbrand-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} School`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } }); // cascades school + branding
});

describe.skipIf(!dbReady)("branding service (DB)", () => {
  it("reads all-null defaults before any branding is configured; tenant derived from school", async () => {
    const b = await getBranding(schoolId);
    expect(b.tenant.id).toBe(tenantId);
    expect(b).toMatchObject({ displayName: null, logoUrl: null, primaryColor: null, updatedAt: null });
  });

  it("saves branding and persists it (a fresh read returns saved values)", async () => {
    const saved = await updateBranding({ actor, schoolId, input: { displayName: "Greenwood", primaryColor: "#112233", accentColor: "#18b0c8", logoUrl: "https://cdn.example.com/logo.png" } });
    expect(saved).toMatchObject({ displayName: "Greenwood", primaryColor: "#112233", accentColor: "#18b0c8", logoUrl: "https://cdn.example.com/logo.png" });
    expect(saved.updatedAt).not.toBeNull();

    const reread = await getBranding(schoolId);
    expect(reread).toMatchObject({ displayName: "Greenwood", primaryColor: "#112233", logoUrl: "https://cdn.example.com/logo.png" });

    const audit = await prisma.auditEvent.findFirst({ where: { entityId: schoolId, action: "BRANDING_UPDATED" } });
    expect(audit).not.toBeNull();
  });

  it("partial update leaves other fields untouched; null clears a field", async () => {
    await updateBranding({ actor, schoolId, input: { footerText: "© Greenwood" } });
    let b = await getBranding(schoolId);
    expect(b.displayName).toBe("Greenwood"); // untouched
    expect(b.footerText).toBe("© Greenwood");

    await updateBranding({ actor, schoolId, input: { displayName: null } });
    b = await getBranding(schoolId);
    expect(b.displayName).toBeNull();
    expect(b.footerText).toBe("© Greenwood"); // still there
  });

  it("rejects invalid colours and non-http URLs", async () => {
    await expect(updateBranding({ actor, schoolId, input: { primaryColor: "red" } })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(updateBranding({ actor, schoolId, input: { primaryColor: "#12" } })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(updateBranding({ actor, schoolId, input: { logoUrl: "javascript:alert(1)" } })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects an unknown school", async () => {
    await expect(getBranding("does-not-exist")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("RBAC: platform.branding.* is platform-scoped (SUPER_ADMIN) and denied to school roles", () => {
    expect(platformPermissionsForRole("SUPER_ADMIN")).toContain("platform.branding.manage");
    expect(platformPermissionsForRole("AUDITOR")).toContain("platform.branding.view");
    expect(platformPermissionsForRole("AUDITOR")).not.toContain("platform.branding.manage");
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      expect(perms).not.toContain("platform.branding.view");
      expect(perms).not.toContain("platform.branding.manage");
    }
  });
});
