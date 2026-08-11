// Platform school provisioning DB-integration tests (Super Admin SA-2).
// Namespaced ("T2-" codes / "@sa2.test" admins) records removed in afterAll.
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  getSchoolDetail,
  listSchools,
  provisionSchool,
  setSchoolStatus,
  updateSchool,
  type PlatformActor,
} from "@/lib/server/platform/schools-service";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const actor: PlatformActor = { id: "sa2-test-actor", name: "SA2 Tester" };
const createdTenantIds: string[] = [];

function input(code: string, over: Record<string, unknown> = {}) {
  return {
    school: { name: `T2-${code} School`, code: `T2-${code}`, email: `office.${code}@t2.test` },
    academicSession: { name: "2026-27", startDate: "2026-04-01", endDate: "2027-03-31" },
    admin: { firstName: "Ada", lastName: "Admin", email: `admin.${code}@sa2.test` },
    ...over,
  };
}

async function provision(code: string, over: Record<string, unknown> = {}) {
  const res = await provisionSchool(actor, input(code, over));
  createdTenantIds.push(res.tenantId);
  return res;
}

afterAll(async () => {
  if (!dbReady) return;
  if (createdTenantIds.length) {
    await prisma.auditEvent.deleteMany({ where: { tenantId: { in: createdTenantIds } } });
    await prisma.tenant.deleteMany({ where: { id: { in: createdTenantIds } } }); // cascades school/branch/session/membership
  }
  await prisma.user.deleteMany({ where: { email: { endsWith: "@sa2.test" } } });
});

describe.skipIf(!dbReady)("platform school provisioning (DB)", () => {
  it("provisions the full foundation in one transaction", async () => {
    const res = await provision("alpha");
    expect(res.schoolId).toBeTruthy();
    expect(res.adminInvitePending).toBe(true);

    const school = await prisma.school.findUniqueOrThrow({
      where: { id: res.schoolId },
      include: { branches: true, academicSessions: true, tenant: true },
    });
    expect(school.status).toBe("SETUP_PENDING");
    expect(school.tenant.id).toBe(res.tenantId);
    // Primary branch.
    expect(school.branches.length).toBe(1);
    expect(school.branches[0].isPrimary).toBe(true);
    expect(school.branches[0].status).toBe("ACTIVE");
    // Current session.
    expect(school.academicSessions.length).toBe(1);
    expect(school.academicSessions[0].isCurrent).toBe(true);
    // Admin user (INVITED, invitation pending) + membership + SCHOOL_ADMIN role.
    const user = await prisma.user.findUniqueOrThrow({ where: { id: res.adminUserId } });
    expect(user.status).toBe("INVITED");
    expect(user.passwordSetupRequired).toBe(true);
    expect(user.passwordHash).toBeNull();
    const membership = await prisma.tenantMembership.findFirstOrThrow({
      where: { userId: res.adminUserId, tenantId: res.tenantId },
      include: { roleAssignments: { include: { role: true } } },
    });
    expect(membership.roleAssignments.some((ra) => ra.role.key === "SCHOOL_ADMIN")).toBe(true);
    // Audit event.
    const audit = await prisma.auditEvent.findFirst({ where: { entityId: res.schoolId, action: "SCHOOL_CREATED" } });
    expect(audit).not.toBeNull();
  });

  it("rejects a duplicate school code and creates nothing", async () => {
    await provision("beta");
    await expect(provisionSchool(actor, input("beta"))).rejects.toMatchObject({ code: "SCHOOL_CODE_EXISTS" });
    // Atomic — the rejected retry left no orphan: still exactly one T2-beta school.
    // (Scoped to our namespaced code; a global tenant.count() would race with
    // other DB test files inserting/deleting rows in parallel.)
    const betaSchools = await prisma.school.count({ where: { code: "T2-beta" } });
    expect(betaSchools).toBe(1);
  });

  it("reuses an existing admin user (adds a membership; never touches the password)", async () => {
    const email = "shared.admin@sa2.test";
    const first = await provision("gamma", { admin: { firstName: "Sh", lastName: "Ared", email } });
    const second = await provision("delta", { admin: { firstName: "Sh", lastName: "Ared", email } });
    expect(second.adminUserId).toBe(first.adminUserId);
    const users = await prisma.user.count({ where: { email } });
    expect(users).toBe(1);
    const memberships = await prisma.tenantMembership.count({ where: { userId: first.adminUserId } });
    expect(memberships).toBeGreaterThanOrEqual(2);
  });

  it("rejects a malformed admin email as a validation error (400, never 500) with no partial rows", async () => {
    // e.g. a markdown/mailto-formatted value that slipped past the client.
    const bad = input("bademail", { admin: { firstName: "N", lastName: "T", email: "[admin@novyra.in](mailto:admin@novyra.in)" } });
    await expect(provisionSchool(actor, bad)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    // Validation happens before the transaction — nothing is created. Assert on
    // our namespaced rows rather than a global tenant.count() (which would race
    // with other DB test files inserting/deleting rows in parallel).
    const school = await prisma.school.findFirst({ where: { code: "T2-bademail" }, select: { id: true } });
    expect(school).toBeNull();
    const admin = await prisma.user.findFirst({ where: { email: "admin.bademail@sa2.test" }, select: { id: true } });
    expect(admin).toBeNull();
  });

  it("rejects a malformed school email as a validation error", async () => {
    const bad = input("badschoolemail", { school: { name: "T2-badschoolemail School", code: "T2-badschoolemail", email: "not-an-email" } });
    await expect(provisionSchool(actor, bad)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects invalid academic-session dates", async () => {
    await expect(
      provisionSchool(actor, input("epsilon", { academicSession: { name: "Bad", startDate: "2027-04-01", endDate: "2026-03-31" } })),
    ).rejects.toMatchObject({ code: "INVALID_SESSION_DATES" });
  });

  it("lists schools with search, status filter and pagination", async () => {
    await provision("listone");
    const page = await listSchools({ page: 1, pageSize: 5, search: "T2-listone" });
    expect(page.data.some((s) => s.code === "T2-listone")).toBe(true);
    expect(page.meta.pageSize).toBe(5);
    // Newly provisioned schools are SETUP_PENDING.
    const pending = await listSchools({ page: 1, pageSize: 50, search: "T2-", status: "setup-pending" });
    expect(pending.data.every((s) => s.status === "setup-pending")).toBe(true);
  });

  it("returns platform-safe detail (no student/secret fields)", async () => {
    const res = await provision("detail");
    const detail = await getSchoolDetail(res.schoolId);
    expect(detail.school.code).toBe("T2-detail");
    expect(detail.branches.length).toBe(1);
    expect(detail.currentSession?.name).toBe("2026-27");
    expect(detail.admins.length).toBe(1);
    expect(detail.admins[0].invitePending).toBe(true);
    // Platform-safe: no student data, no password hash anywhere in the payload.
    expect(JSON.stringify(detail)).not.toMatch(/passwordHash|tokenHash/);
  });

  it("updates allowed school metadata", async () => {
    const res = await provision("upd");
    const updated = await updateSchool(actor, res.schoolId, { name: "T2-upd Renamed", board: "ICSE" });
    expect(updated.school.name).toBe("T2-upd Renamed");
    expect(updated.school.board).toBe("ICSE");
  });

  it("suspends and reactivates a school (audit recorded), refusing a no-op", async () => {
    const res = await provision("susp");
    const suspended = await setSchoolStatus(actor, res.schoolId, { status: "suspended" });
    expect(suspended.school.status).toBe("suspended");
    await expect(setSchoolStatus(actor, res.schoolId, { status: "suspended" })).rejects.toMatchObject({ code: "CONFLICT" });
    const reactivated = await setSchoolStatus(actor, res.schoolId, { status: "active" });
    expect(reactivated.school.status).toBe("active");
    const events = await prisma.auditEvent.findMany({ where: { entityId: res.schoolId, action: { in: ["SCHOOL_SUSPENDED", "SCHOOL_REACTIVATED"] } } });
    expect(events.length).toBe(2);
  });

  it("throws NOT_FOUND for an unknown school", async () => {
    await expect(getSchoolDetail("does-not-exist")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
