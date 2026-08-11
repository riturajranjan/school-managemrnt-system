// Subscriptions DB-integration tests (Super Admin SA-4B). Exercises the real
// subscriptions-service against Postgres: create (active/trial), one-current
// invariant, plan change, cancellation, reactivation, period math, school→tenant
// derivation, list/search/filter/pagination + a catalog RBAC assertion. All data
// is namespaced ("T4B-") and removed in afterAll.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  changePlan,
  createSubscription,
  getSubscription,
  listSubscriptions,
  setSubscriptionStatus,
  updateSubscription,
} from "@/lib/server/platform/subscriptions-service";
import { periodEnd } from "@/lib/server/platform/billing-period";
import { platformPermissionsForRole, ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T4B-";
const stamp = Date.now().toString(36);
let tenantId = "";
let planMonthlyId = "";
let planYearlyId = "";
let planOtherId = "";
let planArchivedId = "";
let sc = 0;

async function makeSchool(label: string, status = "ACTIVE") {
  sc++;
  const s = await prisma.school.create({
    data: { tenantId, name: `${NS}${label} School`, code: `${NS}${stamp}-${sc}`, status: status as never },
    select: { id: true },
  });
  return s.id;
}

beforeAll(async () => {
  if (!dbReady) return;
  const tenant = await prisma.tenant.create({ data: { name: `${NS}Tenant`, slug: `t4b-${stamp}` }, select: { id: true } });
  tenantId = tenant.id;
  const mk = (code: string, extra: Record<string, unknown>) =>
    prisma.plan.create({ data: { code: `${NS}${code}-${stamp}`, name: `${NS}${code}`, status: "ACTIVE", currency: "INR", price: 1000, ...extra }, select: { id: true } });
  planMonthlyId = (await mk("M", { billingInterval: "MONTHLY", trialDays: 14 })).id;
  planYearlyId = (await mk("Y", { billingInterval: "YEARLY", price: 10000 })).id;
  planOtherId = (await mk("O", { billingInterval: "MONTHLY", price: 2000 })).id;
  planArchivedId = (await prisma.plan.create({ data: { code: `${NS}A-${stamp}`, name: `${NS}A`, status: "ARCHIVED", currency: "INR", price: 500, billingInterval: "MONTHLY" }, select: { id: true } })).id;
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.subscription.deleteMany({ where: { tenantId } });
  await prisma.plan.deleteMany({ where: { code: { startsWith: NS } } });
  await prisma.tenant.delete({ where: { id: tenantId } }); // cascades schools
});

describe.skipIf(!dbReady)("subscriptions service (DB)", () => {
  it("creates an ACTIVE subscription, derives tenant from school, snapshots price + monthly period", async () => {
    const schoolId = await makeSchool("active");
    const sub = await createSubscription({ schoolId, planId: planMonthlyId, startMode: "active" });
    expect(sub.status).toBe("active");
    expect(sub.isCurrent).toBe(true);
    // Tenant derived server-side (never from the client).
    expect(sub.tenant.id).toBe(tenantId);
    expect(sub.school.id).toBe(schoolId);
    // Snapshot equals the plan price at creation.
    expect(sub.price).toBe(1000);
    expect(sub.billingInterval).toBe("monthly");
    // Calendar-aware monthly period.
    expect(sub.currentPeriodEnd).toBe(periodEnd(new Date(sub.startDate), "MONTHLY").toISOString());
    expect(sub.trialStart).toBeNull();

    // Direct-DB relationship check (not just the serialized shape).
    const row = await prisma.subscription.findUniqueOrThrow({
      where: { id: sub.id },
      include: { school: { select: { tenantId: true } }, tenant: { select: { id: true } }, plan: { select: { id: true } } },
    });
    expect(row.school.tenantId).toBe(tenantId);
    expect(row.tenant.id).toBe(tenantId);
    expect(row.plan.id).toBe(planMonthlyId);
  });

  it("creates a TRIALING subscription using the plan's trialDays", async () => {
    const schoolId = await makeSchool("trial");
    const sub = await createSubscription({ schoolId, planId: planMonthlyId, startMode: "trial" });
    expect(sub.status).toBe("trialing");
    expect(sub.trialStart).not.toBeNull();
    expect(sub.trialEnd).not.toBeNull();
    const days = Math.round((new Date(sub.trialEnd!).getTime() - new Date(sub.trialStart!).getTime()) / 86_400_000);
    expect(days).toBe(14);
    // Trial period end aligns with trial end.
    expect(sub.currentPeriodEnd).toBe(sub.trialEnd);
  });

  it("computes a calendar-aware YEARLY period", async () => {
    const schoolId = await makeSchool("yearly");
    const sub = await createSubscription({ schoolId, planId: planYearlyId, startMode: "active" });
    expect(sub.billingInterval).toBe("yearly");
    expect(sub.currentPeriodEnd).toBe(periodEnd(new Date(sub.startDate), "YEARLY").toISOString());
    const start = new Date(sub.currentPeriodStart);
    const end = new Date(sub.currentPeriodEnd);
    expect(end.getUTCFullYear() - start.getUTCFullYear()).toBe(1);
  });

  it("prevents a second CURRENT subscription for the same school", async () => {
    const schoolId = await makeSchool("dup");
    await createSubscription({ schoolId, planId: planMonthlyId, startMode: "active" });
    await expect(createSubscription({ schoolId, planId: planOtherId, startMode: "active" })).rejects.toMatchObject({ code: "SUBSCRIPTION_EXISTS" });
  });

  it("rejects assigning an archived (non-active) plan", async () => {
    const schoolId = await makeSchool("arch");
    await expect(createSubscription({ schoolId, planId: planArchivedId, startMode: "active" })).rejects.toMatchObject({ code: "INVALID_PLAN" });
  });

  it("rejects an unknown school", async () => {
    await expect(createSubscription({ schoolId: "nope", planId: planMonthlyId })).rejects.toMatchObject({ code: "INVALID_SCHOOL" });
  });

  it("changes plan (re-snapshots terms) and rejects same-plan / non-active", async () => {
    const schoolId = await makeSchool("change");
    const sub = await createSubscription({ schoolId, planId: planMonthlyId, startMode: "active" });
    const changed = await changePlan(sub.id, { planId: planOtherId });
    expect(changed.plan.id).toBe(planOtherId);
    expect(changed.price).toBe(2000); // re-snapshotted
    await expect(changePlan(sub.id, { planId: planOtherId })).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(changePlan(sub.id, { planId: planArchivedId })).rejects.toMatchObject({ code: "INVALID_PLAN" });
  });

  it("schedules cancel-at-period-end and allows reactivation (revert)", async () => {
    const schoolId = await makeSchool("cape");
    const sub = await createSubscription({ schoolId, planId: planMonthlyId, startMode: "active" });
    const scheduled = await updateSubscription(sub.id, { cancelAtPeriodEnd: true });
    expect(scheduled.cancelAtPeriodEnd).toBe(true);
    expect(scheduled.isCurrent).toBe(true); // still current until period end
    const reverted = await updateSubscription(sub.id, { cancelAtPeriodEnd: false });
    expect(reverted.cancelAtPeriodEnd).toBe(false);
  });

  it("cancels immediately (terminal) and frees the school for a new subscription", async () => {
    const schoolId = await makeSchool("cancel");
    const sub = await createSubscription({ schoolId, planId: planMonthlyId, startMode: "active" });
    const cancelled = await setSubscriptionStatus(sub.id, { status: "cancelled" });
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.isCurrent).toBe(false);
    expect(cancelled.cancelledAt).not.toBeNull();
    expect(cancelled.endedAt).not.toBeNull();
    // Terminal history does not block a fresh current subscription.
    const fresh = await createSubscription({ schoolId, planId: planOtherId, startMode: "active" });
    expect(fresh.status).toBe("active");
    // And the school now has two rows (one terminal, one current).
    const count = await prisma.subscription.count({ where: { schoolId } });
    expect(count).toBe(2);
  });

  it("activates a trial into an active paid subscription with a fresh period", async () => {
    const schoolId = await makeSchool("activate");
    const sub = await createSubscription({ schoolId, planId: planMonthlyId, startMode: "trial" });
    const active = await setSubscriptionStatus(sub.id, { status: "active" });
    expect(active.status).toBe("active");
    expect(active.currentPeriodEnd).toBe(periodEnd(new Date(active.currentPeriodStart), "MONTHLY").toISOString());
  });

  it("lists with search, status filter, plan filter and pagination", async () => {
    // Everything created above belongs to our namespaced tenant/plans, so filter
    // by planId to isolate from parallel test files.
    const byPlan = await listSubscriptions({ page: 1, pageSize: 100, planId: planMonthlyId });
    expect(byPlan.data.length).toBeGreaterThan(0);
    expect(byPlan.data.every((s) => s.plan.id === planMonthlyId)).toBe(true);

    const trialing = await listSubscriptions({ page: 1, pageSize: 100, planId: planMonthlyId, status: "trialing" });
    expect(trialing.data.every((s) => s.status === "trialing")).toBe(true);

    const search = await listSubscriptions({ page: 1, pageSize: 100, search: NS });
    expect(search.data.some((s) => s.school.name.startsWith(NS))).toBe(true);

    const paged = await listSubscriptions({ page: 1, pageSize: 1, planId: planMonthlyId });
    expect(paged.data.length).toBe(1);
    expect(paged.meta.pageSize).toBe(1);
  });

  it("reads a subscription detail and returns only summarized nested objects", async () => {
    const schoolId = await makeSchool("detail");
    const sub = await createSubscription({ schoolId, planId: planMonthlyId, startMode: "active" });
    const detail = await getSubscription(sub.id);
    expect(detail.id).toBe(sub.id);
    // Nested summaries only — no raw Prisma internals leaked.
    expect(Object.keys(detail.school).sort()).toEqual(["code", "id", "name", "status"]);
    expect(Object.keys(detail.tenant).sort()).toEqual(["id", "name", "slug"]);
    await expect(getSubscription("missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("RBAC: platform.subscriptions.* is platform-scoped and denied to school roles", async () => {
    expect(platformPermissionsForRole("SUPER_ADMIN")).toEqual(expect.arrayContaining(["platform.subscriptions.view", "platform.subscriptions.manage"]));
    expect(platformPermissionsForRole("BILLING")).toEqual(expect.arrayContaining(["platform.subscriptions.view", "platform.subscriptions.manage"]));
    // SUPPORT is view-only for subscriptions.
    expect(platformPermissionsForRole("SUPPORT")).toContain("platform.subscriptions.view");
    expect(platformPermissionsForRole("SUPPORT")).not.toContain("platform.subscriptions.manage");
    // Tenant/school roles never carry platform.subscriptions.* (separate domain).
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      expect(perms).not.toContain("platform.subscriptions.view");
      expect(perms).not.toContain("platform.subscriptions.manage");
    }
  });
});
