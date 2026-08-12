// Marketplace DB-integration tests (Super Admin SA-4M). Exercises the real
// marketplace-service against Postgres: catalog create/dup/update/status, school
// install/disable/re-enable (tenant-derived, one row per school+app), non-secret
// config enforcement, honest external boundary, RBAC and audit. Namespaced.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  createApp,
  disableInstall,
  getApp,
  installApp,
  isAppInstalled,
  listApps,
  setAppStatus,
  updateApp,
} from "@/lib/server/platform/marketplace-service";
import { platformPermissionsForRole, ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T4MMKT";
const stamp = Date.now().toString(36);
const actor = { id: "t4mmkt-actor", name: "T4MMKT Tester" };
let tenantId = "";
let schoolId = "";
let appId = "";
const code = (s: string) => `${NS}-${s}-${stamp}`;

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} Tenant`, slug: `t4mmkt-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} School`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } }); // cascades school + installations
  await prisma.marketplaceApp.deleteMany({ where: { code: { startsWith: `${NS}-` } } });
});

describe.skipIf(!dbReady)("marketplace service (DB)", () => {
  it("creates a catalog app (honest external boundary) and rejects a duplicate code", async () => {
    const a = await createApp(actor, { code: code("PAY"), name: "PayThing", category: "payments", providerName: "Acme" });
    appId = a.id;
    expect(a).toMatchObject({ status: "active", category: "payments", providerName: "Acme", installedSchoolCount: 0, connectionConfigured: false });
    await expect(createApp(actor, { code: code("PAY"), name: "dup", category: "payments" })).rejects.toMatchObject({ code: "CONFLICT" });
    const audit = await prisma.auditEvent.findFirst({ where: { entityId: a.id, action: "MARKETPLACE_APP_CREATED" } });
    expect(audit).not.toBeNull();
  });

  it("updates catalog fields and lists the catalog", async () => {
    const updated = await updateApp(actor, appId, { name: "PayThing Pro", documentationUrl: "https://docs.example.com" });
    expect(updated.name).toBe("PayThing Pro");
    expect((await listApps()).some((x) => x.id === appId)).toBe(true);
    expect((await listApps("payments")).some((x) => x.id === appId)).toBe(true);
  });

  it("installs for a real school (tenant derived), then disables and re-enables (one row per school+app)", async () => {
    const installed = await installApp(actor, schoolId, appId);
    expect(installed).toMatchObject({ schoolId, status: "installed", connectionConfigured: false });
    const row = await prisma.schoolMarketplaceInstallation.findFirst({ where: { id: installed.id }, select: { tenantId: true } });
    expect(row?.tenantId).toBe(tenantId); // derived server-side
    expect(await isAppInstalled(schoolId, code("PAY"))).toBe(true);
    const audit = await prisma.auditEvent.findFirst({ where: { entityId: installed.id, action: "MARKETPLACE_APP_INSTALLED" } });
    expect(audit).not.toBeNull();

    const disabled = await disableInstall(actor, schoolId, appId);
    expect(disabled.status).toBe("disabled");
    expect(await isAppInstalled(schoolId, code("PAY"))).toBe(false);

    const reenabled = await installApp(actor, schoolId, appId);
    expect(reenabled.status).toBe("installed");
    expect(await prisma.schoolMarketplaceInstallation.count({ where: { schoolId, appId } })).toBe(1); // one row toggled
    await disableInstall(actor, schoolId, appId); // clean for isolation
  });

  it("persists NON-SECRET config but rejects secret-looking keys", async () => {
    const withConfig = await installApp(actor, schoolId, appId, { region: "ap-south-1", webhookUrl: "https://x.example.com/hook" });
    expect(withConfig.configuration).toMatchObject({ region: "ap-south-1" });
    await expect(installApp(actor, schoolId, appId, { apiKey: "sk_live_123" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(installApp(actor, schoolId, appId, { client_secret: "x" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await disableInstall(actor, schoolId, appId);
  });

  it("archiving a catalog app blocks new installs", async () => {
    await setAppStatus(actor, appId, "archived");
    await expect(installApp(actor, schoolId, appId)).rejects.toMatchObject({ code: "CONFLICT" });
    await setAppStatus(actor, appId, "active");
  });

  it("rejects an unknown app / unknown school", async () => {
    await expect(getApp("nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(installApp(actor, "nope", appId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(installApp(actor, schoolId, "nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("RBAC: platform.marketplace.* is platform-scoped (SUPER_ADMIN) and denied to school roles", () => {
    expect(platformPermissionsForRole("SUPER_ADMIN")).toContain("platform.marketplace.manage");
    expect(platformPermissionsForRole("AUDITOR")).toContain("platform.marketplace.view");
    expect(platformPermissionsForRole("AUDITOR")).not.toContain("platform.marketplace.manage");
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      expect(perms).not.toContain("platform.marketplace.view");
      expect(perms).not.toContain("platform.marketplace.manage");
    }
  });
});
