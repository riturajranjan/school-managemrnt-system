// Announcements DB-integration tests (Super Admin SA-4N). Lifecycle DRAFT →
// PUBLISHED → ARCHIVED, update, and RBAC. Namespaced by created ids (cleaned up).
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  archiveAnnouncement,
  createAnnouncement,
  getAnnouncement,
  publishAnnouncement,
  updateAnnouncement,
} from "@/lib/server/platform/announcements-service";
import { platformPermissionsForRole, ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const actor = { id: "t4n-ann-actor", name: "T4N Ann" };
const created: string[] = [];

afterAll(async () => {
  if (!dbReady) return;
  await prisma.auditEvent.deleteMany({ where: { actorUserId: actor.id } });
  if (created.length) await prisma.platformAnnouncement.deleteMany({ where: { id: { in: created } } });
});

describe.skipIf(!dbReady)("announcements service (DB)", () => {
  it("creates a DRAFT, publishes it (publishedAt set), then archives it", async () => {
    const a = await createAnnouncement(actor, { title: "T4N Term 2", body: "Details soon.", category: "product-update", audience: "all-schools" });
    created.push(a.id);
    expect(a).toMatchObject({ status: "draft", audience: "all-schools", publishedAt: null });

    const published = await publishAnnouncement(actor, a.id);
    expect(published.status).toBe("published");
    expect(published.publishedAt).not.toBeNull();

    const archived = await archiveAnnouncement(actor, a.id);
    expect(archived.status).toBe("archived");
    // Cannot publish an archived announcement.
    await expect(publishAnnouncement(actor, a.id)).rejects.toMatchObject({ code: "CONFLICT" });

    for (const action of ["ANNOUNCEMENT_CREATED", "ANNOUNCEMENT_PUBLISHED", "ANNOUNCEMENT_ARCHIVED"]) {
      expect(await prisma.auditEvent.findFirst({ where: { entityId: a.id, action } })).not.toBeNull();
    }
  });

  it("edits a draft and rejects an unknown id", async () => {
    const a = await createAnnouncement(actor, { title: "T4N Edit", body: "x" });
    created.push(a.id);
    const updated = await updateAnnouncement(actor, a.id, { title: "T4N Edited", audience: "platform-admins" });
    expect(updated).toMatchObject({ title: "T4N Edited", audience: "platform-admins" });
    await expect(getAnnouncement("nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("RBAC: platform.announcements.* SUPER_ADMIN-manage / AUDITOR-view, denied to school roles", () => {
    expect(platformPermissionsForRole("SUPER_ADMIN")).toContain("platform.announcements.manage");
    expect(platformPermissionsForRole("AUDITOR")).toContain("platform.announcements.view");
    expect(platformPermissionsForRole("AUDITOR")).not.toContain("platform.announcements.manage");
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      expect(perms).not.toContain("platform.announcements.view");
      expect(perms).not.toContain("platform.announcements.manage");
    }
  });
});
