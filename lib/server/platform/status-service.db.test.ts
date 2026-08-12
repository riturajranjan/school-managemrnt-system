// Platform status DB-integration tests (Super Admin SA-4N). Honest status
// snapshot (DB reachable, maintenance mode, open incident count) + incident
// lifecycle + RBAC. Namespaced by created ids.
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  createIncident,
  getStatus,
  resolveIncident,
  updateIncident,
} from "@/lib/server/platform/status-service";
import { platformPermissionsForRole, ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const actor = { id: "t4n-status-actor", name: "T4N Status" };
const created: string[] = [];

afterAll(async () => {
  if (!dbReady) return;
  await prisma.auditEvent.deleteMany({ where: { actorUserId: actor.id } });
  if (created.length) await prisma.platformIncident.deleteMany({ where: { id: { in: created } } });
});

describe.skipIf(!dbReady)("status service (DB)", () => {
  it("reports honest signals: DB reachable, boolean maintenance, unmonitored list", async () => {
    const s = await getStatus();
    expect(s.databaseReachable).toBe(true); // we are connected to run this test
    expect(typeof s.maintenanceMode).toBe("boolean");
    expect(Array.isArray(s.unmonitoredServices)).toBe(true);
    expect(s.unmonitoredServices.length).toBeGreaterThan(0);
    expect(typeof s.openIncidentCount).toBe("number");
  });

  it("creates an incident, advances lifecycle, resolves it (resolvedAt set)", async () => {
    const i = await createIncident(actor, { title: "T4N DB latency", description: "elevated latency", severity: "major" });
    created.push(i.id);
    expect(i).toMatchObject({ status: "investigating", severity: "major", resolvedAt: null });

    const monitoring = await updateIncident(actor, i.id, { status: "monitoring" });
    expect(monitoring.status).toBe("monitoring");

    // While open, it counts + appears in the status snapshot.
    const during = await getStatus();
    expect(during.openIncidentCount).toBeGreaterThanOrEqual(1);
    expect(during.activeIncidents.some((x) => x.id === i.id)).toBe(true);

    const resolved = await resolveIncident(actor, i.id);
    expect(resolved.status).toBe("resolved");
    expect(resolved.resolvedAt).not.toBeNull();

    // Resolved incidents drop out of the active set.
    const after = await getStatus();
    expect(after.activeIncidents.some((x) => x.id === i.id)).toBe(false);

    for (const action of ["PLATFORM_INCIDENT_CREATED", "PLATFORM_INCIDENT_UPDATED", "PLATFORM_INCIDENT_RESOLVED"]) {
      expect(await prisma.auditEvent.findFirst({ where: { entityId: i.id, action } })).not.toBeNull();
    }
  });

  it("rejects an unknown incident", async () => {
    await expect(updateIncident(actor, "nope", { status: "monitoring" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("RBAC: platform.status.* SUPER_ADMIN-manage / AUDITOR-view, denied to school roles", () => {
    expect(platformPermissionsForRole("SUPER_ADMIN")).toContain("platform.status.manage");
    expect(platformPermissionsForRole("AUDITOR")).toContain("platform.status.view");
    expect(platformPermissionsForRole("AUDITOR")).not.toContain("platform.status.manage");
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      expect(perms).not.toContain("platform.status.view");
      expect(perms).not.toContain("platform.status.manage");
    }
  });
});
