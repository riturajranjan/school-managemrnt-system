// Dashboard summary DB-integration tests (Super Admin SA-4J). Real school
// lifecycle counts from School rows. The month boundary is tested deterministically
// with an injected reference time in a far-future month (so only our fixtures fall
// inside it — no wall-clock flakiness, no interference from other test files).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { getDashboardSummary } from "@/lib/server/platform/dashboard-service";
import { platformPermissionsForRole, ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T4DASH";
const stamp = Date.now().toString(36);
// A far-future reference month so only this file's in-month fixture qualifies.
const REF_NOW = new Date("2099-06-15T00:00:00Z");
const IN_MONTH = new Date("2099-06-10T00:00:00Z"); // June 2099
const BEFORE_MONTH = new Date("2099-05-20T00:00:00Z"); // May 2099
let tenantId = "";
let sc = 0;

async function makeSchool(status: string, createdAt?: Date) {
  sc++;
  await prisma.school.create({
    data: { tenantId, name: `${NS} ${status} ${sc}`, code: `${NS}-${stamp}-${sc}`, status: status as never, ...(createdAt ? { createdAt } : {}) },
  });
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} Tenant`, slug: `t4dash-${stamp}` }, select: { id: true } })).id;
  await makeSchool("ACTIVE");
  await makeSchool("SETUP_PENDING");
  await makeSchool("SUSPENDED");
  await makeSchool("ACTIVE", IN_MONTH); // counts for REF_NOW's month
  await makeSchool("ACTIVE", BEFORE_MONTH); // does NOT count for REF_NOW's month
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.tenant.delete({ where: { id: tenantId } }); // cascades schools
});

describe.skipIf(!dbReady)("dashboard summary service (DB)", () => {
  it("counts real school lifecycle statuses (global lower bounds)", async () => {
    const s = await getDashboardSummary();
    expect(s.totalSchools).toBeGreaterThanOrEqual(5);
    expect(s.activeSchools).toBeGreaterThanOrEqual(3);
    expect(s.setupPendingSchools).toBeGreaterThanOrEqual(1);
    expect(s.suspendedSchools).toBeGreaterThanOrEqual(1);
    // Counts sum consistently (active+setup+suspended ≤ total; other statuses exist).
    expect(s.activeSchools + s.setupPendingSchools + s.suspendedSchools).toBeLessThanOrEqual(s.totalSchools);
  });

  it("newThisMonth = createdAt >= start of the reference calendar month (deterministic)", async () => {
    // Only the IN_MONTH fixture falls in June 2099; BEFORE_MONTH (May 2099) does not.
    const s = await getDashboardSummary(REF_NOW);
    expect(s.newSchoolsThisMonth).toBe(1);

    // A reference month AFTER all fixtures counts none (createdAt >= its start).
    const later = await getDashboardSummary(new Date("2099-08-15T00:00:00Z"));
    expect(later.newSchoolsThisMonth).toBe(0);
  });

  it("RBAC: platform.dashboard.view is platform-scoped and denied to school roles", async () => {
    for (const role of ["SUPER_ADMIN", "SUPPORT", "BILLING", "AUDITOR"]) {
      expect(platformPermissionsForRole(role)).toContain("platform.dashboard.view");
    }
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      expect(perms).not.toContain("platform.dashboard.view");
    }
  });
});
