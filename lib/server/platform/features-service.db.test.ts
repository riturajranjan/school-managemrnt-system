// Feature entitlement DB-integration tests (Super Admin SA-4L). Exercises the
// real features-service against Postgres: plan defaults from PlanFeature, school
// overrides (on/off + clear), effective resolution, no-subscription behaviour,
// unknown-key rejection, tenant/school derivation, the enforcement primitive
// (hasFeature/requireFeature), and RBAC. Namespaced ("T4LFEAT-").
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  clearFeatureOverride,
  getEffectiveFeaturesForSchool,
  hasFeature,
  requireFeature,
  setFeatureOverride,
} from "@/lib/server/platform/features-service";
import { platformPermissionsForRole, ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T4LFEAT";
const stamp = Date.now().toString(36);
const actor = { id: "t4lfeat-actor", name: "T4LFEAT Tester" };
let tenantId = "";
let schoolId = ""; // has a subscription to a plan with [students, admissions, fees]
let unsubSchoolId = ""; // no subscription

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} Tenant`, slug: `t4lfeat-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} School`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  unsubSchoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} Unsub`, code: `${NS}-U-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;

  const plan = await prisma.plan.create({
    data: {
      code: `${NS}-PLAN-${stamp}`, name: `${NS} Plan`, price: 1000, status: "ACTIVE",
      features: { create: [{ key: "students" }, { key: "admissions" }, { key: "fees" }] },
    },
    select: { id: true },
  });
  const now = new Date();
  await prisma.subscription.create({
    data: {
      tenantId, schoolId, planId: plan.id, status: "ACTIVE",
      startDate: now, currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + 30 * 864e5),
      priceAmount: 1000, currency: "INR", billingInterval: "MONTHLY",
    },
  });
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } }); // cascades schools/subscriptions/overrides
  await prisma.plan.deleteMany({ where: { code: `${NS}-PLAN-${stamp}` } });
});

describe.skipIf(!dbReady)("features service (DB)", () => {
  it("resolves plan defaults from PlanFeature and derives the tenant from the school", async () => {
    const res = await getEffectiveFeaturesForSchool(schoolId);
    expect(res.hasSubscription).toBe(true);
    expect(res.tenant.id).toBe(tenantId); // derived server-side
    const byKey = new Map(res.features.map((f) => [f.key, f]));
    // In the plan → included by default, no override → effective true.
    for (const k of ["students", "admissions", "fees"]) {
      expect(byKey.get(k)).toMatchObject({ planDefault: true, override: null, effective: true });
    }
    // Not in the plan → default off.
    expect(byKey.get("transport")).toMatchObject({ planDefault: false, override: null, effective: false });
  });

  it("override ON enables a feature the plan does not include", async () => {
    const res = await setFeatureOverride({ actor, schoolId, featureKey: "transport", enabled: true, reason: "pilot" });
    const f = res.features.find((x) => x.key === "transport")!;
    expect(f).toMatchObject({ planDefault: false, override: true, effective: true, reason: "pilot" });
    expect(await hasFeature(schoolId, "transport")).toBe(true);
    const audit = await prisma.auditEvent.findFirst({ where: { entityId: `${schoolId}:transport`, action: "FEATURE_OVERRIDE_SET" } });
    expect(audit).not.toBeNull();
    await clearFeatureOverride({ actor, schoolId, featureKey: "transport" });
  });

  it("override OFF disables a plan-included feature; clear reverts to the default", async () => {
    let res = await setFeatureOverride({ actor, schoolId, featureKey: "students", enabled: false });
    expect(res.features.find((x) => x.key === "students")).toMatchObject({ planDefault: true, override: false, effective: false });
    expect(await hasFeature(schoolId, "students")).toBe(false);

    res = await clearFeatureOverride({ actor, schoolId, featureKey: "students" });
    expect(res.features.find((x) => x.key === "students")).toMatchObject({ planDefault: true, override: null, effective: true });
    expect(await hasFeature(schoolId, "students")).toBe(true);
  });

  it("a school with no active subscription has every plan default off", async () => {
    const res = await getEffectiveFeaturesForSchool(unsubSchoolId);
    expect(res.hasSubscription).toBe(false);
    expect(res.plan).toBeNull();
    expect(res.features.every((f) => f.planDefault === false && f.effective === false)).toBe(true);
  });

  it("rejects an unknown feature key and an unknown school", async () => {
    await expect(setFeatureOverride({ actor, schoolId, featureKey: "not-a-feature", enabled: true })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(getEffectiveFeaturesForSchool("does-not-exist")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("requireFeature throws FORBIDDEN when the school is not entitled", async () => {
    await expect(requireFeature(schoolId, "library")).rejects.toMatchObject({ code: "FORBIDDEN" }); // not in plan, no override
    await expect(requireFeature(schoolId, "students")).resolves.toBeUndefined(); // in plan
  });

  it("RBAC: platform.features.* is platform-scoped (SUPER_ADMIN) and denied to school roles", () => {
    expect(platformPermissionsForRole("SUPER_ADMIN")).toContain("platform.features.manage");
    expect(platformPermissionsForRole("AUDITOR")).toContain("platform.features.view");
    expect(platformPermissionsForRole("AUDITOR")).not.toContain("platform.features.manage");
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      expect(perms).not.toContain("platform.features.view");
      expect(perms).not.toContain("platform.features.manage");
    }
  });
});
