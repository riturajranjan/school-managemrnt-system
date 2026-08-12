// Add-ons DB-integration tests (Super Admin SA-4M). Exercises the real
// addons-service against Postgres: catalog create/dup/update/status, school
// assignment (tenant-derived, commercial snapshot, duplicate prevention, remove),
// the hasAddOn entitlement resolver, RBAC and audit. Namespaced ("T4MADD-").
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  assignAddOn,
  createAddOn,
  getAddOn,
  hasAddOn,
  listAddOns,
  removeSchoolAddOn,
  setAddOnStatus,
  updateAddOn,
} from "@/lib/server/platform/addons-service";
import { platformPermissionsForRole, ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T4MADD";
const stamp = Date.now().toString(36);
const actor = { id: "t4madd-actor", name: "T4MADD Tester" };
let tenantId = "";
let schoolId = "";
let addOnId = "";
const code = (s: string) => `${NS}-${s}-${stamp}`;

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} Tenant`, slug: `t4madd-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} School`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } }); // cascades school + assignments
  await prisma.addOn.deleteMany({ where: { code: { startsWith: `${NS}-` } } }); // catalog is global
});

describe.skipIf(!dbReady)("addons service (DB)", () => {
  it("creates a catalog add-on and rejects a duplicate code", async () => {
    const a = await createAddOn(actor, { code: code("PREMIUM"), name: "Premium thing", category: "Support", priceAmount: 1200, billingInterval: "monthly" });
    addOnId = a.id;
    expect(a).toMatchObject({ status: "active", priceAmount: 1200, currency: "INR", billingInterval: "monthly", assignedSchoolCount: 0 });
    await expect(createAddOn(actor, { code: code("PREMIUM"), name: "dup" })).rejects.toMatchObject({ code: "CONFLICT" });
    const audit = await prisma.auditEvent.findFirst({ where: { entityId: a.id, action: "ADDON_CREATED" } });
    expect(audit).not.toBeNull();
  });

  it("updates catalog fields and lists the catalog", async () => {
    const updated = await updateAddOn(actor, addOnId, { name: "Premium Plus", priceAmount: 1500 });
    expect(updated).toMatchObject({ name: "Premium Plus", priceAmount: 1500 });
    const list = await listAddOns();
    expect(list.some((x) => x.id === addOnId)).toBe(true);
  });

  it("assigns to a real school (tenant derived, terms snapshotted); prevents a duplicate active assignment", async () => {
    const assigned = await assignAddOn(actor, schoolId, addOnId);
    expect(assigned).toMatchObject({ schoolId, status: "active", priceAmount: 1500, currency: "INR", billingInterval: "monthly" });
    // Tenant derived server-side from the school.
    const row = await prisma.schoolAddOn.findFirst({ where: { id: assigned.id }, select: { tenantId: true } });
    expect(row?.tenantId).toBe(tenantId);
    expect(await hasAddOn(schoolId, code("PREMIUM"))).toBe(true);
    // Duplicate active assignment rejected.
    await expect(assignAddOn(actor, schoolId, addOnId)).rejects.toMatchObject({ code: "CONFLICT" });
    const audit = await prisma.auditEvent.findFirst({ where: { entityId: assigned.id, action: "ADDON_ASSIGNED" } });
    expect(audit).not.toBeNull();
  });

  it("removes an assignment (ENDED) and can re-assign afterwards (idempotent per school+add-on)", async () => {
    const current = (await prisma.schoolAddOn.findUnique({ where: { schoolId_addOnId: { schoolId, addOnId } }, select: { id: true } }))!;
    const removed = await removeSchoolAddOn(actor, schoolId, current.id);
    expect(removed.status).toBe("ended");
    expect(await hasAddOn(schoolId, code("PREMIUM"))).toBe(false);
    // Re-assign reactivates the same row (no duplicate).
    const reassigned = await assignAddOn(actor, schoolId, addOnId);
    expect(reassigned.status).toBe("active");
    const count = await prisma.schoolAddOn.count({ where: { schoolId, addOnId } });
    expect(count).toBe(1);
    // Clean back to ended for isolation.
    await removeSchoolAddOn(actor, schoolId, reassigned.id);
  });

  it("archiving a catalog add-on blocks new assignments", async () => {
    const archived = await setAddOnStatus(actor, addOnId, "archived");
    expect(archived.status).toBe("archived");
    await expect(assignAddOn(actor, schoolId, addOnId)).rejects.toMatchObject({ code: "CONFLICT" });
    await setAddOnStatus(actor, addOnId, "active"); // restore
  });

  it("rejects an unknown add-on / unknown school", async () => {
    await expect(getAddOn("nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(assignAddOn(actor, "nope", addOnId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(assignAddOn(actor, schoolId, "nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("RBAC: platform.addons.* is platform-scoped (SUPER_ADMIN) and denied to school roles", () => {
    expect(platformPermissionsForRole("SUPER_ADMIN")).toContain("platform.addons.manage");
    expect(platformPermissionsForRole("AUDITOR")).toContain("platform.addons.view");
    expect(platformPermissionsForRole("AUDITOR")).not.toContain("platform.addons.manage");
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      expect(perms).not.toContain("platform.addons.view");
      expect(perms).not.toContain("platform.addons.manage");
    }
  });
});
