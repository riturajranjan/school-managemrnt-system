// Trials DB-integration tests (Super Admin SA-4C). Trials are Subscriptions with
// a trial window; this exercises the real trials-service against Postgres —
// list/search/filter/pagination/detail, daysRemaining + state derivation,
// extend/convert/end (+ audit events), invalid states, and a catalog RBAC
// assertion. Namespaced ("T4C-") and removed in afterAll. Timestamps are
// controlled by seeding explicit trialEnd values (no wall-clock flakiness).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  convertTrial,
  endTrial,
  extendTrial,
  getTrial,
  listTrials,
  EXPIRING_THRESHOLD_DAYS,
  type TrialActor,
} from "@/lib/server/platform/trials-service";
import { platformPermissionsForRole, ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T4C-";
const stamp = Date.now().toString(36);
const actor: TrialActor = { id: "t4c-actor", name: "T4C Tester" };
let tenantId = "";
let planId = "";
let sc = 0;

const DAY = 86_400_000;

async function makeSchool() {
  sc++;
  const s = await prisma.school.create({ data: { tenantId, name: `${NS}School ${sc}`, code: `${NS}${stamp}-${sc}`, status: "ACTIVE" }, select: { id: true } });
  return s.id;
}

/** Create a subscription row directly with an explicit trial window + status. */
async function makeTrial(opts: { status?: "TRIALING" | "ACTIVE" | "ENDED"; trialEndOffsetDays?: number; withTrial?: boolean } = {}) {
  const schoolId = await makeSchool();
  const now = new Date();
  const withTrial = opts.withTrial ?? true;
  const trialStart = withTrial ? new Date(now.getTime() - 2 * DAY) : null;
  const trialEnd = withTrial ? new Date(now.getTime() + (opts.trialEndOffsetDays ?? 10) * DAY) : null;
  const sub = await prisma.subscription.create({
    data: {
      tenantId,
      schoolId,
      planId,
      status: opts.status ?? "TRIALING",
      startDate: now,
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd ?? now,
      trialStart,
      trialEnd,
      priceAmount: 1000,
      currency: "INR",
      billingInterval: "MONTHLY",
    },
    select: { id: true },
  });
  return { subscriptionId: sub.id, schoolId };
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS}Tenant`, slug: `t4c-${stamp}` }, select: { id: true } })).id;
  planId = (await prisma.plan.create({ data: { code: `${NS}P-${stamp}`, name: `${NS}Plan`, status: "ACTIVE", currency: "INR", price: 1000, billingInterval: "MONTHLY", trialDays: 14 }, select: { id: true } })).id;
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId } });
  await prisma.subscription.deleteMany({ where: { tenantId } });
  await prisma.plan.deleteMany({ where: { code: { startsWith: NS } } });
  await prisma.tenant.delete({ where: { id: tenantId } });
});

describe.skipIf(!dbReady)("trials service (DB)", () => {
  it("lists trial-origin subscriptions with server-derived state + daysRemaining", async () => {
    const { subscriptionId } = await makeTrial({ trialEndOffsetDays: 10 });
    const page = await listTrials({ page: 1, pageSize: 100, planId });
    const row = page.data.find((t) => t.subscriptionId === subscriptionId);
    expect(row).toBeDefined();
    expect(row!.state).toBe("active");
    expect(row!.daysRemaining).toBeGreaterThan(EXPIRING_THRESHOLD_DAYS);
    expect(row!.tenant.id).toBe(tenantId);
    expect(row!.plan.id).toBe(planId);
  });

  it("excludes non-trial subscriptions (no trial window) from the list", async () => {
    const { subscriptionId } = await makeTrial({ status: "ACTIVE", withTrial: false });
    const page = await listTrials({ page: 1, pageSize: 100, planId });
    expect(page.data.some((t) => t.subscriptionId === subscriptionId)).toBe(false);
  });

  it("derives expiring / expired states from persisted trialEnd", async () => {
    const expiring = await makeTrial({ trialEndOffsetDays: 2 }); // within threshold
    const expired = await makeTrial({ trialEndOffsetDays: -1 }); // past
    const exp = await getTrial(expiring.subscriptionId);
    const old = await getTrial(expired.subscriptionId);
    expect(exp.state).toBe("expiring");
    expect(old.state).toBe("expired");
    expect(old.daysRemaining).toBeLessThanOrEqual(0);
    // Expired trials are NOT auto-transitioned — still TRIALING in the DB.
    const row = await prisma.subscription.findUniqueOrThrow({ where: { id: expired.subscriptionId }, select: { status: true } });
    expect(row.status).toBe("TRIALING");
  });

  it("filters by state and plan, and paginates", async () => {
    await makeTrial({ trialEndOffsetDays: 1 }); // expiring
    const expiring = await listTrials({ page: 1, pageSize: 100, planId, state: "expiring" });
    expect(expiring.data.length).toBeGreaterThan(0);
    expect(expiring.data.every((t) => t.state === "expiring")).toBe(true);

    const search = await listTrials({ page: 1, pageSize: 100, search: NS });
    expect(search.data.some((t) => t.school.name.startsWith(NS))).toBe(true);

    const paged = await listTrials({ page: 1, pageSize: 1, planId });
    expect(paged.data.length).toBe(1);
    expect(paged.meta.pageSize).toBe(1);
  });

  it("extends a trial (persists new trialEnd) and writes an audit event", async () => {
    const { subscriptionId } = await makeTrial({ trialEndOffsetDays: 5 });
    const before = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId }, select: { trialEnd: true } });
    const extended = await extendTrial(actor, subscriptionId, { days: 7 });
    const after = new Date(extended.trialEnd!);
    expect(after.getTime()).toBeGreaterThan(before.trialEnd!.getTime());
    // +7 days from the previous (future) trialEnd.
    expect(Math.round((after.getTime() - before.trialEnd!.getTime()) / DAY)).toBe(7);
    const audit = await prisma.auditEvent.findFirst({ where: { entityId: subscriptionId, action: "TRIAL_EXTENDED" } });
    expect(audit).not.toBeNull();
    expect(audit!.tenantId).toBe(tenantId);
  });

  it("rejects invalid extension days", async () => {
    const { subscriptionId } = await makeTrial();
    await expect(extendTrial(actor, subscriptionId, { days: 0 })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(extendTrial(actor, subscriptionId, { days: 9999 })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("converts TRIALING → ACTIVE with a fresh monthly period + audit", async () => {
    const { subscriptionId } = await makeTrial();
    const converted = await convertTrial(actor, subscriptionId);
    expect(converted.status).toBe("active");
    expect(converted.state).toBe("converted");
    const row = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId }, select: { status: true, currentPeriodEnd: true, currentPeriodStart: true } });
    expect(row.status).toBe("ACTIVE");
    // ~1 month period.
    const months = (row.currentPeriodEnd.getUTCFullYear() - row.currentPeriodStart.getUTCFullYear()) * 12 + (row.currentPeriodEnd.getUTCMonth() - row.currentPeriodStart.getUTCMonth());
    expect(months).toBe(1);
    const audit = await prisma.auditEvent.findFirst({ where: { entityId: subscriptionId, action: "TRIAL_CONVERTED" } });
    expect(audit).not.toBeNull();
  });

  it("ends TRIALING → ENDED (history preserved) + audit", async () => {
    const { subscriptionId } = await makeTrial();
    const ended = await endTrial(actor, subscriptionId);
    expect(ended.status).toBe("ended");
    expect(ended.state).toBe("ended");
    const row = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId }, select: { status: true, endedAt: true, trialStart: true } });
    expect(row.status).toBe("ENDED");
    expect(row.endedAt).not.toBeNull();
    expect(row.trialStart).not.toBeNull(); // history kept
    const audit = await prisma.auditEvent.findFirst({ where: { entityId: subscriptionId, action: "TRIAL_ENDED" } });
    expect(audit).not.toBeNull();
  });

  it("rejects actions on a non-trialing subscription and unknown ids", async () => {
    const { subscriptionId } = await makeTrial();
    await convertTrial(actor, subscriptionId); // now ACTIVE
    await expect(convertTrial(actor, subscriptionId)).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
    await expect(extendTrial(actor, subscriptionId, { days: 3 })).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
    await expect(endTrial(actor, subscriptionId)).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
    await expect(getTrial("nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("RBAC: platform.trials.* is platform-scoped and denied to school roles", async () => {
    expect(platformPermissionsForRole("SUPER_ADMIN")).toEqual(expect.arrayContaining(["platform.trials.view", "platform.trials.manage"]));
    expect(platformPermissionsForRole("BILLING")).toEqual(expect.arrayContaining(["platform.trials.view", "platform.trials.manage"]));
    // SUPPORT is view-only for trials; AUDITOR is view-only.
    expect(platformPermissionsForRole("SUPPORT")).toContain("platform.trials.view");
    expect(platformPermissionsForRole("SUPPORT")).not.toContain("platform.trials.manage");
    expect(platformPermissionsForRole("AUDITOR")).toContain("platform.trials.view");
    expect(platformPermissionsForRole("AUDITOR")).not.toContain("platform.trials.manage");
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      expect(perms).not.toContain("platform.trials.view");
      expect(perms).not.toContain("platform.trials.manage");
    }
  });
});
