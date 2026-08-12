// Platform settings DB-integration tests (Super Admin SA-4N). Singleton get
// (auto-creates defaults), update + persistence, and RBAC.
//
// NOTE: PlatformSetting is a shared SINGLETON row (id "singleton"). These tests
// mutate it, so they SNAPSHOT it in beforeAll and RESTORE it in afterAll — a
// prior version left it polluted (platformName "Novyra T4N") in the dev DB, which
// surfaced on the real Settings page. Never leave shared-singleton test writes.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { getSettings, updateSettings } from "@/lib/server/platform/settings-service";
import { platformPermissionsForRole, ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const actor = { id: "t4n-settings-actor", name: "T4N Settings" };
let snapshot: Record<string, unknown> | null = null;

beforeAll(async () => {
  if (!dbReady) return;
  snapshot = await prisma.platformSetting.findUnique({ where: { id: "singleton" } });
});

afterAll(async () => {
  if (!dbReady) return;
  // Restore the singleton to exactly its pre-test state (or remove it if it did
  // not exist before), so the shared dev DB is never left polluted by the tests.
  if (snapshot) {
    const { id, createdAt, updatedAt, ...rest } = snapshot as { id: string; createdAt: unknown; updatedAt: unknown };
    void id; void createdAt; void updatedAt;
    await prisma.platformSetting.update({ where: { id: "singleton" }, data: rest as never });
  } else {
    await prisma.platformSetting.deleteMany({ where: { id: "singleton" } });
  }
});

describe.skipIf(!dbReady)("platform settings service (DB)", () => {
  it("reads the singleton (auto-creating defaults) and persists an update", async () => {
    const initial = await getSettings();
    expect(typeof initial.platformName).toBe("string");
    expect(typeof initial.maintenanceMode).toBe("boolean");

    const saved = await updateSettings(actor, { platformName: "Novyra T4N", defaultTrialDays: 21, maintenanceMode: true, maintenanceMessage: "brb" });
    expect(saved).toMatchObject({ platformName: "Novyra T4N", defaultTrialDays: 21, maintenanceMode: true, maintenanceMessage: "brb" });

    // Fresh read returns the persisted values (singleton, one row).
    const reread = await getSettings();
    expect(reread).toMatchObject({ platformName: "Novyra T4N", defaultTrialDays: 21, maintenanceMode: true });
    const rows = await prisma.platformSetting.count();
    expect(rows).toBe(1);

    const audit = await prisma.auditEvent.findFirst({ where: { entityType: "PlatformSetting", action: "PLATFORM_SETTINGS_UPDATED" } });
    expect(audit).not.toBeNull();

    // Restore maintenance off so the status test isn't affected.
    await updateSettings(actor, { maintenanceMode: false, maintenanceMessage: null });
  });

  it("rejects invalid input (bad email / bad currency)", async () => {
    await expect(updateSettings(actor, { supportEmail: "not-an-email" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(updateSettings(actor, { defaultCurrency: "RUPEES" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("RBAC: platform.settings.* is SUPER_ADMIN-manage / AUDITOR-view, denied to school roles", () => {
    expect(platformPermissionsForRole("SUPER_ADMIN")).toContain("platform.settings.manage");
    expect(platformPermissionsForRole("AUDITOR")).toContain("platform.settings.view");
    expect(platformPermissionsForRole("AUDITOR")).not.toContain("platform.settings.manage");
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      expect(perms).not.toContain("platform.settings.view");
      expect(perms).not.toContain("platform.settings.manage");
    }
  });
});
