// Plan catalog DB-integration tests (Super Admin SA-4A). Exercises the real
// plans-service against Postgres: create/list/search/filter/pagination/detail/
// update/duplicate-code/archive/reactivate + a catalog RBAC assertion. Plan codes
// are globally unique, so everything is namespaced "T4-" and removed in afterAll.
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  createPlan,
  getPlan,
  listPlans,
  setPlanStatus,
  updatePlan,
} from "@/lib/server/platform/plans-service";
import { ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";
import { platformPermissionsForRole } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T4-";
let n = 0;
const code = (s: string) => `${NS}${s}-${Date.now().toString(36)}-${n++}`;

afterAll(async () => {
  if (!dbReady) return;
  // planFeature cascades on plan delete.
  await prisma.plan.deleteMany({ where: { code: { startsWith: NS } } });
});

describe.skipIf(!dbReady)("plans service (DB)", () => {
  it("creates a plan with structured price, limits and features", async () => {
    const c = code("STARTER");
    const plan = await createPlan({
      code: c.toLowerCase(), // service upper-cases
      name: "Starter",
      price: 4999,
      billingInterval: "monthly",
      trialDays: 14,
      status: "active",
      supportLevel: "standard",
      limits: { maxStudents: 300, maxStaff: 30, maxBranches: 1, storageGb: 10 },
      features: ["students", "admissions", "students"], // dupes deduped
    });
    expect(plan.code).toBe(c.toUpperCase());
    expect(plan.price).toBe(4999);
    expect(plan.currency).toBe("INR");
    expect(plan.billingInterval).toBe("monthly");
    expect(plan.status).toBe("active");
    expect(plan.limits.maxStudents).toBe(300);
    expect([...plan.features].sort()).toEqual(["admissions", "students"]);

    // Persisted read matches.
    const fresh = await getPlan(plan.id);
    expect(fresh.price).toBe(4999);
    expect(fresh.features.length).toBe(2);
  });

  it("rejects a duplicate code with PLAN_CODE_EXISTS", async () => {
    const c = code("DUP");
    await createPlan({ code: c, name: "Dup", price: 100 });
    await expect(createPlan({ code: c, name: "Dup 2", price: 200 })).rejects.toMatchObject({ code: "PLAN_CODE_EXISTS" });
  });

  it("stores unlimited (null) limits when omitted", async () => {
    const plan = await createPlan({ code: code("ENT"), name: "Enterprise", price: 49999, whiteLabel: true });
    expect(plan.limits.maxStudents).toBeNull();
    expect(plan.limits.storageGb).toBeNull();
    expect(plan.whiteLabel).toBe(true);
  });

  it("lists with search, status filter, billingInterval filter and pagination", async () => {
    const a = await createPlan({ code: code("LISTA"), name: "List Alpha", price: 100, status: "active", billingInterval: "monthly" });
    const d = await createPlan({ code: code("LISTD"), name: "List Draft", price: 200, status: "draft", billingInterval: "yearly" });

    const search = await listPlans({ page: 1, pageSize: 50, search: NS });
    const codes = search.data.map((p) => p.id);
    expect(codes).toContain(a.id);
    expect(codes).toContain(d.id);

    const drafts = await listPlans({ page: 1, pageSize: 50, search: NS, status: "draft" });
    expect(drafts.data.every((p) => p.status === "draft")).toBe(true);
    expect(drafts.data.some((p) => p.id === d.id)).toBe(true);
    expect(drafts.data.some((p) => p.id === a.id)).toBe(false);

    const yearly = await listPlans({ page: 1, pageSize: 50, search: NS, billingInterval: "yearly" });
    expect(yearly.data.every((p) => p.billingInterval === "yearly")).toBe(true);

    const paged = await listPlans({ page: 1, pageSize: 1, search: NS });
    expect(paged.data.length).toBe(1);
    expect(paged.meta.pageSize).toBe(1);
    expect(paged.meta.totalPages).toBeGreaterThanOrEqual(paged.meta.total > 1 ? 2 : 1);
  });

  it("updates fields and replaces features atomically", async () => {
    const plan = await createPlan({ code: code("UPD"), name: "Upd", price: 100, features: ["students"] });
    const updated = await updatePlan(plan.id, {
      name: "Upd Renamed",
      price: 250,
      billingInterval: "yearly",
      limits: { maxStudents: 500 },
      features: ["fees", "communication"],
    });
    expect(updated.name).toBe("Upd Renamed");
    expect(updated.price).toBe(250);
    expect(updated.billingInterval).toBe("yearly");
    expect(updated.limits.maxStudents).toBe(500);
    expect([...updated.features].sort()).toEqual(["communication", "fees"]);
    // "students" was removed.
    expect(updated.features).not.toContain("students");
  });

  it("archives (sets archivedAt) then reactivates a plan", async () => {
    const plan = await createPlan({ code: code("ARCH"), name: "Arch", price: 100, status: "active" });
    const archived = await setPlanStatus(plan.id, { status: "archived" });
    expect(archived.status).toBe("archived");
    expect(archived.archivedAt).not.toBeNull();

    const reactivated = await setPlanStatus(plan.id, { status: "active" });
    expect(reactivated.status).toBe("active");
    expect(reactivated.archivedAt).toBeNull();

    // Re-setting the same status conflicts.
    await expect(setPlanStatus(plan.id, { status: "active" })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("throws NOT_FOUND for a missing plan", async () => {
    await expect(getPlan("does-not-exist")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("RBAC: platform.plans.* is platform-scoped for SUPER_ADMIN/BILLING and denied to school roles", async () => {
    // Platform roles.
    const superAdmin = platformPermissionsForRole("SUPER_ADMIN");
    const billing = platformPermissionsForRole("BILLING");
    const support = platformPermissionsForRole("SUPPORT");
    expect(superAdmin).toEqual(expect.arrayContaining(["platform.plans.view", "platform.plans.manage"]));
    expect(billing).toEqual(expect.arrayContaining(["platform.plans.view", "platform.plans.manage"]));
    expect(support).not.toContain("platform.plans.manage");

    // Tenant/school roles never carry platform.plans.* (separate permission domain).
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      expect(perms).not.toContain("platform.plans.view");
      expect(perms).not.toContain("platform.plans.manage");
    }
  });
});
