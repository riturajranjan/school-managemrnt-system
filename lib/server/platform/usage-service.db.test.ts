// Usage & limits DB-integration tests (Super Admin SA-4G). Usage is derived live
// from real Student/Branch rows vs Plan limits. Builds deterministic fixtures
// (NORMAL/WARNING/LIMIT_REACHED/UNLIMITED/NO_SUBSCRIPTION, plus NOT_TRACKED
// staff/storage) under a namespaced tenant and asserts states/counts, summary,
// list/filter/pagination, RBAC and the health integration. Namespaced ("T4U-"),
// removed in afterAll.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { getSchoolUsage, getUsageSummary, listUsage } from "@/lib/server/platform/usage-service";
import { listTenantHealth } from "@/lib/server/platform/health-service";
import { platformPermissionsForRole, ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T4U-";
const stamp = Date.now().toString(36);
let tenantId = "";
let planLimited = ""; // maxStudents=10, maxBranches=2
let planUnlimited = ""; // maxStudents=null
let sc = 0;
const ids: Record<string, string> = {};

const DOB = new Date("2015-06-01");

async function makeSchool(label: string) {
  sc++;
  const school = await prisma.school.create({ data: { tenantId, name: `${NS}${label}`, code: `${NS}${stamp}-${sc}`, status: "ACTIVE" }, select: { id: true } });
  const branch = await prisma.branch.create({ data: { schoolId: school.id, name: `${NS}B`, code: `${NS}B-${sc}`, status: "ACTIVE" }, select: { id: true } });
  const session = await prisma.academicSession.create({ data: { schoolId: school.id, name: "2026-27", code: `${NS}S-${sc}`, startDate: new Date("2026-04-01"), endDate: new Date("2027-03-31") }, select: { id: true } });
  return { schoolId: school.id, branchId: branch.id, sessionId: session.id };
}

async function addStudents(ctx: { schoolId: string; branchId: string; sessionId: string }, count: number) {
  if (count === 0) return;
  await prisma.student.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      tenantId,
      schoolId: ctx.schoolId,
      branchId: ctx.branchId,
      academicSessionId: ctx.sessionId,
      admissionNumber: `${NS}${stamp}-${sc}-${i}`,
      firstName: "Test",
      lastName: `Student${i}`,
      dateOfBirth: DOB,
      admissionDate: DOB,
      status: "ACTIVE",
    })),
  });
}

async function subscribe(schoolId: string, planId: string) {
  const now = new Date();
  await prisma.subscription.create({
    data: { tenantId, schoolId, planId, status: "ACTIVE", startDate: now, currentPeriodStart: now, currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000), priceAmount: 1000, currency: "INR", billingInterval: "MONTHLY" },
  });
}

function metric(u: { metrics: { key: string; state: string; used: number | null; limit: number | null; percent: number | null }[] }, key: string) {
  return u.metrics.find((m) => m.key === key)!;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS}Tenant`, slug: `t4u-${stamp}` }, select: { id: true } })).id;
  planLimited = (await prisma.plan.create({ data: { code: `${NS}L-${stamp}`, name: `${NS}Limited`, status: "ACTIVE", currency: "INR", price: 1000, billingInterval: "MONTHLY", maxStudents: 10, maxBranches: 2 }, select: { id: true } })).id;
  planUnlimited = (await prisma.plan.create({ data: { code: `${NS}U-${stamp}`, name: `${NS}Unlimited`, status: "ACTIVE", currency: "INR", price: 1000, billingInterval: "MONTHLY", maxStudents: null, maxBranches: null }, select: { id: true } })).id;

  const normal = await makeSchool("Normal"); ids.normal = normal.schoolId; await addStudents(normal, 5); await subscribe(normal.schoolId, planLimited); // 5/10 = 50%
  const warn = await makeSchool("Warning"); ids.warn = warn.schoolId; await addStudents(warn, 9); await subscribe(warn.schoolId, planLimited); // 9/10 = 90%
  const limit = await makeSchool("Limit"); ids.limit = limit.schoolId; await addStudents(limit, 10); await subscribe(limit.schoolId, planLimited); // 10/10 = 100%
  const unlimited = await makeSchool("Unlimited"); ids.unlimited = unlimited.schoolId; await addStudents(unlimited, 3); await subscribe(unlimited.schoolId, planUnlimited);
  const noSub = await makeSchool("NoSub"); ids.noSub = noSub.schoolId; await addStudents(noSub, 2); // no subscription
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.student.deleteMany({ where: { tenantId } });
  await prisma.subscription.deleteMany({ where: { tenantId } });
  await prisma.plan.deleteMany({ where: { code: { startsWith: NS } } });
  await prisma.tenant.delete({ where: { id: tenantId } }); // cascades schools/branches/sessions
});

describe.skipIf(!dbReady)("usage service (DB)", () => {
  it("NORMAL: 5 real students of 10 → 50%", async () => {
    const u = (await getSchoolUsage(ids.normal))!;
    const m = metric(u, "students");
    expect(m.used).toBe(5);
    expect(m.limit).toBe(10);
    expect(m.percent).toBe(50);
    expect(m.state).toBe("NORMAL");
  });

  it("WARNING: 9 of 10 → 90%", async () => {
    const m = metric((await getSchoolUsage(ids.warn))!, "students");
    expect(m.used).toBe(9);
    expect(m.percent).toBe(90);
    expect(m.state).toBe("WARNING");
  });

  it("LIMIT_REACHED: 10 of 10 → 100%", async () => {
    const m = metric((await getSchoolUsage(ids.limit))!, "students");
    expect(m.used).toBe(10);
    expect(m.percent).toBe(100);
    expect(m.state).toBe("LIMIT_REACHED");
  });

  it("UNLIMITED: null plan limit keeps real count but no percent", async () => {
    const m = metric((await getSchoolUsage(ids.unlimited))!, "students");
    expect(m.used).toBe(3);
    expect(m.limit).toBeNull();
    expect(m.percent).toBeNull();
    expect(m.state).toBe("UNLIMITED");
  });

  it("NO_SUBSCRIPTION: no current subscription → no limits (used still real)", async () => {
    const u = (await getSchoolUsage(ids.noSub))!;
    expect(u.plan).toBeNull();
    const m = metric(u, "students");
    expect(m.used).toBe(2);
    expect(m.state).toBe("NO_SUBSCRIPTION");
  });

  it("branches are counted from real Branch rows", async () => {
    const m = metric((await getSchoolUsage(ids.normal))!, "branches");
    expect(m.used).toBe(1); // one branch created per fixture school
    expect(m.limit).toBe(2);
    expect(m.state).toBe("NORMAL");
  });

  it("staff and storage are honestly NOT_TRACKED (never fabricated)", async () => {
    const u = (await getSchoolUsage(ids.normal))!;
    expect(metric(u, "staff").state).toBe("NOT_TRACKED");
    expect(metric(u, "staff").used).toBeNull();
    expect(metric(u, "storage").state).toBe("NOT_TRACKED");
    expect(metric(u, "storage").used).toBeNull();
  });

  it("lists with state filter, search and pagination", async () => {
    const warnList = await listUsage({ page: 1, pageSize: 100, search: NS, state: "WARNING" });
    expect(warnList.data.some((u) => u.schoolId === ids.warn)).toBe(true);
    expect(warnList.data.every((u) => u.metrics.some((m) => m.state === "WARNING"))).toBe(true);

    const atLimit = await listUsage({ page: 1, pageSize: 100, search: NS, state: "LIMIT_REACHED" });
    expect(atLimit.data.some((u) => u.schoolId === ids.limit)).toBe(true);

    const paged = await listUsage({ page: 1, pageSize: 1, search: NS });
    expect(paged.data.length).toBe(1);
    expect(paged.meta.total).toBeGreaterThanOrEqual(5);
  });

  it("summary counts warnings from tracked metrics only", async () => {
    const s = await getUsageSummary();
    expect(s.schoolsTracked).toBeGreaterThanOrEqual(4);
    expect(s.studentLimitWarnings).toBeGreaterThanOrEqual(2); // warn + limit
    expect(s.schoolsAtLimit).toBeGreaterThanOrEqual(1);
    expect(s.limitWarnings).toBeGreaterThanOrEqual(2);
  });

  it("health integration: a student LIMIT_REACHED school surfaces an ATTENTION usage reason", async () => {
    const page = await listTenantHealth({ page: 1, pageSize: 100, search: `${NS}Limit` });
    const h = page.data.find((x) => x.schoolId === ids.limit);
    expect(h).toBeDefined();
    expect(["attention", "critical"]).toContain(h!.healthState);
    expect(h!.reasons.some((r) => /limit reached/i.test(r))).toBe(true);
  });

  it("RBAC: platform.usage.view is platform-scoped and denied to school roles", async () => {
    for (const role of ["SUPER_ADMIN", "BILLING", "SUPPORT", "AUDITOR"]) {
      expect(platformPermissionsForRole(role)).toContain("platform.usage.view");
    }
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      expect(perms).not.toContain("platform.usage.view");
    }
  });
});
