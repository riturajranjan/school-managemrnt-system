// Custom-domain DB-integration tests (Super Admin SA-4L). Exercises the real
// domains-service against Postgres: create (hostname normalisation + validation),
// duplicate rejection, tenant-derived-from-school, first-domain-primary rule,
// MANUAL status transitions (no fake DNS), delete, and RBAC. Namespaced.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  createDomain,
  deleteDomain,
  listDomains,
  setDomainStatus,
} from "@/lib/server/platform/domains-service";
import { platformPermissionsForRole, ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T4LDOM";
const stamp = Date.now().toString(36);
const actor = { id: "t4ldom-actor", name: "T4LDOM Tester" };
let tenantId = "";
let schoolId = "";
const host = (s: string) => `${s}-${stamp}.example.com`;

beforeAll(async () => {
  if (!dbReady) return;
  tenantId = (await prisma.tenant.create({ data: { name: `${NS} Tenant`, slug: `t4ldom-${stamp}` }, select: { id: true } })).id;
  schoolId = (await prisma.school.create({ data: { tenantId, name: `${NS} School`, code: `${NS}-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
});

afterAll(async () => {
  if (!dbReady || !tenantId) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId } });
  await prisma.tenant.delete({ where: { id: tenantId } }); // cascades schools + domains
});

describe.skipIf(!dbReady)("domains service (DB)", () => {
  it("registers a hostname: derives tenant from school, first domain is primary, status PENDING", async () => {
    const d = await createDomain({ actor, schoolId, hostname: host("portal"), type: "custom" });
    expect(d).toMatchObject({ hostname: host("portal"), type: "custom", status: "pending", isPrimary: true });
    expect(d.tenant.id).toBe(tenantId); // derived server-side, not client-sent
    expect(d.verifiedAt).toBeNull();
    const audit = await prisma.auditEvent.findFirst({ where: { entityId: d.id, action: "DOMAIN_ADDED" } });
    expect(audit).not.toBeNull();
    await deleteDomain({ actor, domainId: d.id });
  });

  it("second domain for the same school is NOT primary", async () => {
    const a = await createDomain({ actor, schoolId, hostname: host("a") });
    const b = await createDomain({ actor, schoolId, hostname: host("b") });
    expect(a.isPrimary).toBe(true);
    expect(b.isPrimary).toBe(false);
    await deleteDomain({ actor, domainId: a.id });
    await deleteDomain({ actor, domainId: b.id });
  });

  it("rejects malformed hostnames (protocol/path/space) and duplicates", async () => {
    await expect(createDomain({ actor, schoolId, hostname: "https://portal.example.com" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(createDomain({ actor, schoolId, hostname: "portal.example.com/login" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(createDomain({ actor, schoolId, hostname: "not a host" })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });

    const dup = await createDomain({ actor, schoolId, hostname: host("dup") });
    await expect(createDomain({ actor, schoolId, hostname: host("dup") })).rejects.toMatchObject({ code: "CONFLICT" });
    await deleteDomain({ actor, domainId: dup.id });
  });

  it("MANUAL verification: PENDING → VERIFIED sets verifiedAt; invalid jump rejected", async () => {
    const d = await createDomain({ actor, schoolId, hostname: host("verify") });
    const verified = await setDomainStatus({ actor, domainId: d.id, status: "verified" });
    expect(verified.status).toBe("verified");
    expect(verified.verifiedAt).not.toBeNull();
    const audit = await prisma.auditEvent.findFirst({ where: { entityId: d.id, action: "DOMAIN_STATUS_CHANGED" } });
    expect(audit).not.toBeNull();
    // VERIFIED → PENDING is not an allowed manual move.
    await expect(setDomainStatus({ actor, domainId: d.id, status: "pending" })).rejects.toMatchObject({ code: "INVALID_STATUS_TRANSITION" });
    // VERIFIED → DISABLED is allowed.
    const disabled = await setDomainStatus({ actor, domainId: d.id, status: "disabled" });
    expect(disabled.status).toBe("disabled");
    await deleteDomain({ actor, domainId: d.id });
  });

  it("lists domains scoped to a school", async () => {
    const d = await createDomain({ actor, schoolId, hostname: host("list") });
    const rows = await listDomains(schoolId);
    expect(rows.some((r) => r.id === d.id)).toBe(true);
    expect(rows.every((r) => r.school.id === schoolId)).toBe(true);
    await deleteDomain({ actor, domainId: d.id });
  });

  it("rejects an unknown school / unknown domain", async () => {
    await expect(createDomain({ actor, schoolId: "nope", hostname: host("x") })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(setDomainStatus({ actor, domainId: "nope", status: "verified" })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("RBAC: platform.domains.* is platform-scoped (SUPER_ADMIN) and denied to school roles", () => {
    expect(platformPermissionsForRole("SUPER_ADMIN")).toContain("platform.domains.manage");
    expect(platformPermissionsForRole("AUDITOR")).toContain("platform.domains.view");
    expect(platformPermissionsForRole("AUDITOR")).not.toContain("platform.domains.manage");
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      expect(perms).not.toContain("platform.domains.view");
      expect(perms).not.toContain("platform.domains.manage");
    }
  });
});
