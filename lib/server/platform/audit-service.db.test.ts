// Audit read-service DB-integration tests (Super Admin SA-4N). Paginated/filtered
// read over the real AuditEvent table, safe DTO (secret-key stripping), and RBAC.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { listAuditEvents } from "@/lib/server/platform/audit-service";
import { platformPermissionsForRole, ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T4NAUDIT";
const stamp = Date.now().toString(36);
const actorId = `t4naudit-${stamp}`;
const action = `T4N_TEST_ACTION_${stamp}`;

beforeAll(async () => {
  if (!dbReady) return;
  // Seed a few real AuditEvent rows with a namespaced action + a secret-looking
  // meta key that the safe DTO must strip.
  await prisma.auditEvent.createMany({
    data: [0, 1, 2].map((n) => ({
      tenantId: "", schoolId: null, actorUserId: actorId, actorName: "T4N Auditor",
      action, entityType: "T4NThing", entityId: `${NS}-${n}`,
      metaJson: { safeField: "ok", apiKey: "sk_should_be_stripped" },
    })),
  });
});

afterAll(async () => {
  if (!dbReady) return;
  await prisma.auditEvent.deleteMany({ where: { actorUserId: actorId } });
});

describe.skipIf(!dbReady)("audit read service (DB)", () => {
  it("lists paginated, filtered by action, with correct meta", async () => {
    const res = await listAuditEvents({ page: 1, pageSize: 2, action });
    expect(res.data.length).toBe(2); // pageSize honoured
    expect(res.meta.total).toBe(3);
    expect(res.meta.totalPages).toBe(2);
    expect(res.data.every((e) => e.action === action)).toBe(true);
  });

  it("filters by actor and search", async () => {
    const byActor = await listAuditEvents({ page: 1, pageSize: 50, actor: actorId });
    expect(byActor.data.length).toBe(3);
    const bySearch = await listAuditEvents({ page: 1, pageSize: 50, search: action });
    expect(bySearch.data.some((e) => e.action === action)).toBe(true);
  });

  it("safe DTO strips secret-looking metadata keys", async () => {
    const res = await listAuditEvents({ page: 1, pageSize: 1, action });
    const meta = res.data[0].meta ?? {};
    expect(meta).toHaveProperty("safeField", "ok");
    expect(meta).not.toHaveProperty("apiKey"); // stripped
  });

  it("RBAC: platform.audit.view is platform-scoped (SUPER_ADMIN + AUDITOR), denied to school roles", () => {
    expect(platformPermissionsForRole("SUPER_ADMIN")).toContain("platform.audit.view");
    expect(platformPermissionsForRole("AUDITOR")).toContain("platform.audit.view");
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      expect(perms).not.toContain("platform.audit.view");
    }
  });
});
