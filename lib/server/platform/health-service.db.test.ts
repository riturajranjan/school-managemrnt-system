// Tenant-health DB-integration tests (Super Admin SA-4F). Health is derived from
// real signals; this builds deterministic fixture schools (healthy / attention /
// critical) under a namespaced tenant and asserts the derived state + reasons,
// the summary/pulse shape, plus search/filter/pagination and RBAC. Namespaced
// ("T4H-"), removed in afterAll. Time is controlled via explicit trial/due dates.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { getHealthSummary, listTenantHealth } from "@/lib/server/platform/health-service";
import { platformPermissionsForRole, ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T4H-";
const stamp = Date.now().toString(36);
let tenantId = "";
let planId = "";
let sc = 0;
const DAY = 86_400_000;

async function makeSchool(label: string, status = "ACTIVE") {
  sc++;
  const s = await prisma.school.create({ data: { tenantId, name: `${NS}${label}`, code: `${NS}${stamp}-${sc}`, status: status as never }, select: { id: true } });
  return s.id;
}

async function makeSub(schoolId: string, status: "ACTIVE" | "TRIALING" | "PAST_DUE", opts: { trialEndDays?: number } = {}) {
  const now = new Date();
  const trialEnd = opts.trialEndDays !== undefined ? new Date(now.getTime() + opts.trialEndDays * DAY) : null;
  return prisma.subscription.create({
    data: {
      tenantId,
      schoolId,
      planId,
      status,
      startDate: now,
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd ?? new Date(now.getTime() + 30 * DAY),
      trialStart: trialEnd ? now : null,
      trialEnd,
      priceAmount: 1000,
      currency: "INR",
      billingInterval: "MONTHLY",
    },
    select: { id: true },
  });
}

async function makeOverdueInvoice(schoolId: string, subscriptionId: string) {
  const now = new Date();
  const start = new Date(now.getTime() - 60 * DAY);
  return prisma.invoice.create({
    data: {
      invoiceNumber: `${NS}INV-${stamp}-${sc}-${Math.random().toString(36).slice(2, 7)}`,
      tenantId,
      schoolId,
      subscriptionId,
      status: "OPEN",
      currency: "INR",
      subtotal: 1000,
      totalAmount: 1000,
      amountDue: 1000,
      periodStart: start,
      periodEnd: new Date(start.getTime() + 30 * DAY),
      dueAt: new Date(now.getTime() - 5 * DAY), // past due
    },
    select: { id: true },
  });
}

// Fixture school ids by scenario.
const ids: Record<string, string> = {};

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS}Tenant`, slug: `t4h-${stamp}` }, select: { id: true } })).id;
  planId = (await prisma.plan.create({ data: { code: `${NS}P-${stamp}`, name: `${NS}Plan`, status: "ACTIVE", currency: "INR", price: 1000, billingInterval: "MONTHLY" }, select: { id: true } })).id;

  // Healthy: ACTIVE school, ACTIVE subscription, no invoices.
  ids.healthy = await makeSchool("Healthy", "ACTIVE");
  await makeSub(ids.healthy, "ACTIVE");

  // Attention (onboarding): SETUP_PENDING school.
  ids.setup = await makeSchool("Setup", "SETUP_PENDING");

  // Attention (trial expiring): ACTIVE school, TRIALING sub ending in 2 days.
  ids.trial = await makeSchool("Trial", "ACTIVE");
  await makeSub(ids.trial, "TRIALING", { trialEndDays: 2 });

  // Attention (overdue invoice): ACTIVE school, ACTIVE sub, past-due OPEN invoice.
  ids.overdue = await makeSchool("Overdue", "ACTIVE");
  const overdueSub = await makeSub(ids.overdue, "ACTIVE");
  await makeOverdueInvoice(ids.overdue, overdueSub.id);

  // Critical (suspended): SUSPENDED school.
  ids.suspended = await makeSchool("Suspended", "SUSPENDED");

  // Critical (past-due subscription): ACTIVE school, PAST_DUE sub.
  ids.pastdue = await makeSchool("PastDue", "ACTIVE");
  await makeSub(ids.pastdue, "PAST_DUE");
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.invoice.deleteMany({ where: { tenantId } });
  await prisma.subscription.deleteMany({ where: { tenantId } });
  await prisma.plan.deleteMany({ where: { code: { startsWith: NS } } });
  await prisma.tenant.delete({ where: { id: tenantId } }); // cascades schools
});

async function healthFor(schoolId: string) {
  const page = await listTenantHealth({ page: 1, pageSize: 100, search: NS });
  return page.data.find((h) => h.schoolId === schoolId);
}

describe.skipIf(!dbReady)("tenant health service (DB)", () => {
  it("HEALTHY: active school + active subscription + no overdue", async () => {
    const h = await healthFor(ids.healthy);
    expect(h?.healthState).toBe("healthy");
    expect(h?.subscriptionStatus).toBe("active");
    expect(h?.overdueInvoices).toBe(0);
    expect(h?.reasons).toContain("All indicators healthy");
  });

  it("ATTENTION: setup-pending school flags incomplete onboarding", async () => {
    const h = await healthFor(ids.setup);
    expect(h?.healthState).toBe("attention");
    expect(h?.reasons.some((r) => /onboarding/i.test(r))).toBe(true);
  });

  it("ATTENTION: trialing subscription expiring soon", async () => {
    const h = await healthFor(ids.trial);
    expect(h?.healthState).toBe("attention");
    expect(h?.subscriptionStatus).toBe("trialing");
    expect(h?.trialDaysRemaining).toBeLessThanOrEqual(3);
    expect(h?.reasons.some((r) => /trial/i.test(r))).toBe(true);
  });

  it("ATTENTION: overdue invoice (with real outstanding amount)", async () => {
    const h = await healthFor(ids.overdue);
    expect(h?.healthState).toBe("attention");
    expect(h?.overdueInvoices).toBe(1);
    expect(h?.outstandingAmount).toBe(1000);
    expect(h?.reasons.some((r) => /overdue/i.test(r))).toBe(true);
  });

  it("CRITICAL: suspended school", async () => {
    const h = await healthFor(ids.suspended);
    expect(h?.healthState).toBe("critical");
    expect(h?.reasons).toContain("School is suspended");
  });

  it("CRITICAL: past-due subscription", async () => {
    const h = await healthFor(ids.pastdue);
    expect(h?.healthState).toBe("critical");
    expect(h?.subscriptionStatus).toBe("past-due");
    expect(h?.reasons).toContain("Subscription is past due");
  });

  it("lists with healthState filter, search and pagination", async () => {
    const critical = await listTenantHealth({ page: 1, pageSize: 100, search: NS, healthState: "critical" });
    expect(critical.data.length).toBeGreaterThanOrEqual(2);
    expect(critical.data.every((h) => h.healthState === "critical")).toBe(true);

    const named = await listTenantHealth({ page: 1, pageSize: 100, search: `${NS}Healthy` });
    expect(named.data.some((h) => h.schoolId === ids.healthy)).toBe(true);

    const paged = await listTenantHealth({ page: 1, pageSize: 1, search: NS });
    expect(paged.data.length).toBe(1);
    expect(paged.meta.pageSize).toBe(1);
    expect(paged.meta.total).toBeGreaterThanOrEqual(6);
  });

  it("summary + platform pulse are well-formed (global aggregates)", async () => {
    const s = await getHealthSummary();
    expect(s.totalSchools).toBeGreaterThanOrEqual(6);
    // Our fixtures contribute at least these.
    expect(s.critical).toBeGreaterThanOrEqual(2);
    expect(s.attention).toBeGreaterThanOrEqual(3);
    expect(s.healthy).toBeGreaterThanOrEqual(1);
    expect(s.pastDueSubscriptions).toBeGreaterThanOrEqual(1);
    expect(s.overdueInvoices).toBeGreaterThanOrEqual(1);
    expect(s.currency).toBe("INR");
    // Pulse is derived only from real factors.
    expect(s.pulse.factors).toHaveLength(5);
    expect(s.pulse.score).toBeGreaterThanOrEqual(0);
    expect(s.pulse.score).toBeLessThanOrEqual(100);
    expect(s.pulse.factors.map((f) => f.key).sort()).toEqual(["active", "billing", "collections", "onboarding", "subscriptions"]);
  });

  it("RBAC: platform.tenant_health.view is platform-scoped and denied to school roles", async () => {
    for (const role of ["SUPER_ADMIN", "BILLING", "SUPPORT", "AUDITOR"]) {
      expect(platformPermissionsForRole(role)).toContain("platform.tenant_health.view");
    }
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      expect(perms).not.toContain("platform.tenant_health.view");
    }
  });
});
