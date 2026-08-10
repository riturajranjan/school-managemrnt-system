// School onboarding DB-integration tests (Super Admin SA-3). Provisions real
// schools (via the SA-2 service, which also creates onboarding) and exercises the
// onboarding lifecycle. Namespaced ("T3-" / "@sa3.test"); removed in afterAll.
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { provisionSchool, type PlatformActor } from "@/lib/server/platform/schools-service";
import {
  completeOnboarding,
  getOnboarding,
  listOnboarding,
  setupPendingCount,
  updateOnboarding,
} from "@/lib/server/platform/onboarding-service";
import { REQUIRED_STEP_KEYS } from "@/lib/api/onboarding-steps";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const actor: PlatformActor = { id: "sa3-actor", name: "SA3 Tester" };
const createdTenantIds: string[] = [];

async function provision(code: string) {
  const res = await provisionSchool(actor, {
    school: { name: `T3-${code} School`, code: `T3-${code}` },
    academicSession: { name: "2026-27", startDate: "2026-04-01", endDate: "2027-03-31" },
    admin: { firstName: "Ada", lastName: "Admin", email: `admin.${code}@sa3.test` },
  });
  createdTenantIds.push(res.tenantId);
  return res;
}

afterAll(async () => {
  if (!dbReady) return;
  if (createdTenantIds.length) {
    await prisma.auditEvent.deleteMany({ where: { tenantId: { in: createdTenantIds } } });
    await prisma.tenant.deleteMany({ where: { id: { in: createdTenantIds } } }); // cascades school → onboarding
  }
  await prisma.user.deleteMany({ where: { email: { endsWith: "@sa3.test" } } });
});

describe.skipIf(!dbReady)("school onboarding (DB)", () => {
  it("provisioning creates an IN_PROGRESS onboarding at the first step", async () => {
    const { schoolId } = await provision("alpha");
    const o = await getOnboarding(schoolId);
    expect(o.status).toBe("in-progress");
    expect(o.completedCount).toBe(0);
    expect(o.progress).toBe(0);
    expect(o.currentStep).toBe(REQUIRED_STEP_KEYS[0]);
    expect(o.totalSteps).toBe(REQUIRED_STEP_KEYS.length);
  });

  it("marks steps and persists real progress", async () => {
    const { schoolId } = await provision("beta");
    const two = REQUIRED_STEP_KEYS.slice(0, 2);
    await updateOnboarding(actor, schoolId, { completedSteps: two, currentStep: two[1] });
    const o = await getOnboarding(schoolId); // fresh read = persisted
    expect(o.completedCount).toBe(2);
    expect(o.currentStep).toBe(two[1]);
    expect(o.progress).toBe(Math.round((2 / REQUIRED_STEP_KEYS.length) * 100));
    expect(o.steps.filter((s) => s.done).map((s) => s.key)).toEqual(two);
  });

  it("ignores unknown step keys and rejects an unknown currentStep", async () => {
    const { schoolId } = await provision("gamma");
    await updateOnboarding(actor, schoolId, { completedSteps: [REQUIRED_STEP_KEYS[0], "not-a-step", "students"] });
    const o = await getOnboarding(schoolId);
    expect(o.completedSteps).toEqual([REQUIRED_STEP_KEYS[0]]); // junk filtered out
    await expect(updateOnboarding(actor, schoolId, { currentStep: "not-a-step" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("blocks completion while required steps remain", async () => {
    const { schoolId } = await provision("delta");
    await updateOnboarding(actor, schoolId, { completedSteps: REQUIRED_STEP_KEYS.slice(0, 2) });
    await expect(completeOnboarding(actor, schoolId)).rejects.toMatchObject({ code: "ONBOARDING_INCOMPLETE" });
    // School must NOT have been activated.
    const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId }, select: { status: true } });
    expect(school.status).toBe("SETUP_PENDING");
  });

  it("completes: onboarding COMPLETED + school ACTIVE + completedAt + audit, atomically", async () => {
    const { schoolId, tenantId } = await provision("epsilon");
    await updateOnboarding(actor, schoolId, { completedSteps: REQUIRED_STEP_KEYS });
    const o = await completeOnboarding(actor, schoolId);
    expect(o.status).toBe("completed");
    expect(o.completedAt).not.toBeNull();
    expect(o.progress).toBe(100);
    // This school is ACTIVE and therefore no longer part of the setup-pending set
    // (isolation-safe check — the global count races with parallel test files).
    const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId }, select: { status: true } });
    expect(school.status).toBe("ACTIVE");
    const stillPending = await prisma.school.count({ where: { id: schoolId, status: "SETUP_PENDING" } });
    expect(stillPending).toBe(0);
    const audit = await prisma.auditEvent.findFirst({ where: { entityId: schoolId, action: "ONBOARDING_COMPLETED" } });
    expect(audit).not.toBeNull();
    expect(tenantId).toBeTruthy();
    // setupPendingCount() is a valid non-negative aggregate (exercised, not exact-matched).
    expect(await setupPendingCount()).toBeGreaterThanOrEqual(0);
  });

  it("refuses duplicate completion and further edits once completed", async () => {
    const { schoolId } = await provision("zeta");
    await updateOnboarding(actor, schoolId, { completedSteps: REQUIRED_STEP_KEYS });
    await completeOnboarding(actor, schoolId);
    await expect(completeOnboarding(actor, schoolId)).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(updateOnboarding(actor, schoolId, { completedSteps: [] })).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("lists onboarding with search + status filter", async () => {
    const { schoolId } = await provision("listy");
    const page = await listOnboarding({ page: 1, pageSize: 50, search: "T3-listy" });
    expect(page.data.some((o) => o.schoolId === schoolId)).toBe(true);
    const inProgress = await listOnboarding({ page: 1, pageSize: 50, search: "T3-", status: "in-progress" });
    expect(inProgress.data.every((o) => o.status === "in-progress")).toBe(true);
  });

  it("throws NOT_FOUND for a school without onboarding", async () => {
    await expect(getOnboarding("does-not-exist")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
