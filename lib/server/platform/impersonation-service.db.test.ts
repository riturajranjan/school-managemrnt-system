// Server-authoritative impersonation DB-integration tests (Super Admin SA-4K).
// Exercises the real impersonation-service + authz resolver + org-scope branch
// against Postgres: start/stop/current, tenant-derived-from-school, one-active
// per session, target-status policy, audit events, session-cascade (logout /
// expiry) invalidation, and the read-only inspection permission composition.
// Namespaced ("T4KIMP-"). Read/write; skips if DB unreachable/unseeded.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  getActiveImpersonation,
  resolveActiveTarget,
  startImpersonation,
  stopImpersonation,
} from "@/lib/server/platform/impersonation-service";
import { requireOrgScope } from "@/lib/server/api/scope";
import type { AuthzContext } from "@/lib/server/authz/permissions";
import {
  INSPECTION_PERMISSION_KEYS,
  PLATFORM_ROLE_PERMISSIONS,
  ROLE_PERMISSIONS,
  platformPermissionsForRole,
} from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T4KIMP";
const stamp = Date.now().toString(36);

let tenantAId = "";
let schoolAId = ""; // ACTIVE, tenant A — the main inspection target
let archivedSchoolId = ""; // ARCHIVED, tenant A — ineligible
let tenantBId = "";
let schoolBId = ""; // ACTIVE, tenant B — cross-tenant target
let platformUserId = "";
let actor: { id: string; name: string | null } = { id: "", name: null };

// Each test that starts an impersonation uses its OWN session row (sessionId is
// unique per active impersonation), so parallel `it`s never collide.
async function makeSession(): Promise<string> {
  const s = await prisma.session.create({
    data: {
      userId: platformUserId,
      tokenHash: `${NS}-${stamp}-${Math.random().toString(36).slice(2)}`,
      expiresAt: new Date(Date.now() + 3_600_000),
    },
    select: { id: true },
  });
  return s.id;
}

beforeAll(async () => {
  if (!dbReady) return;
  tenantAId = (await prisma.tenant.create({ data: { name: `${NS} TenantA`, slug: `t4kimp-a-${stamp}` }, select: { id: true } })).id;
  schoolAId = (await prisma.school.create({ data: { tenantId: tenantAId, name: `${NS} School A`, code: `${NS}-A-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;
  archivedSchoolId = (await prisma.school.create({ data: { tenantId: tenantAId, name: `${NS} Archived`, code: `${NS}-ARC-${stamp}`, status: "ARCHIVED" }, select: { id: true } })).id;
  tenantBId = (await prisma.tenant.create({ data: { name: `${NS} TenantB`, slug: `t4kimp-b-${stamp}` }, select: { id: true } })).id;
  schoolBId = (await prisma.school.create({ data: { tenantId: tenantBId, name: `${NS} School B`, code: `${NS}-B-${stamp}`, status: "ACTIVE" }, select: { id: true } })).id;

  const user = await prisma.user.create({ data: { email: `${NS.toLowerCase()}.${stamp}@platform.test`, name: `${NS} Admin`, status: "ACTIVE" }, select: { id: true, name: true } });
  platformUserId = user.id;
  actor = { id: user.id, name: user.name };
  await prisma.platformAdmin.create({ data: { userId: user.id, role: "SUPER_ADMIN", status: "ACTIVE" } });
});

afterAll(async () => {
  if (!dbReady) return;
  await prisma.auditEvent.deleteMany({ where: { tenantId: { in: [tenantAId, tenantBId].filter(Boolean) } } });
  if (platformUserId) await prisma.session.deleteMany({ where: { userId: platformUserId } }); // cascades impersonations
  if (tenantAId) await prisma.tenant.delete({ where: { id: tenantAId } }).catch(() => {}); // cascades schools
  if (tenantBId) await prisma.tenant.delete({ where: { id: tenantBId } }).catch(() => {});
  if (platformUserId) await prisma.user.delete({ where: { id: platformUserId } }).catch(() => {}); // cascades platformAdmin
});

describe.skipIf(!dbReady)("impersonation service (DB)", () => {
  it("starts read-only inspection: derives tenant from the school, persists a row, audits", async () => {
    const sessionId = await makeSession();
    const state = await startImpersonation({ sessionId, actor, schoolId: schoolAId });
    expect(state).toMatchObject({ active: true, readOnly: true });
    if (state.active) {
      expect(state.school.id).toBe(schoolAId);
      expect(state.tenant.id).toBe(tenantAId); // derived server-side, never supplied
    }

    // Real row bound to the session, with the server-derived tenant.
    const row = await prisma.platformImpersonation.findUnique({ where: { sessionId }, select: { targetTenantId: true, targetSchoolId: true, platformUserId: true } });
    expect(row).toMatchObject({ targetTenantId: tenantAId, targetSchoolId: schoolAId, platformUserId: actor.id });

    // Audit: IMPERSONATION_STARTED against the TARGET (tenant/school), actor = admin.
    const audit = await prisma.auditEvent.findFirst({ where: { entityId: schoolAId, action: "IMPERSONATION_STARTED" }, select: { tenantId: true, actorUserId: true } });
    expect(audit).toMatchObject({ tenantId: tenantAId, actorUserId: actor.id });

    await stopImpersonation({ sessionId, actor });
  });

  it("resolveActiveTarget + getActiveImpersonation reflect live server state", async () => {
    const sessionId = await makeSession();
    expect(await resolveActiveTarget(sessionId)).toBeNull();
    expect(await getActiveImpersonation(sessionId)).toEqual({ active: false });

    await startImpersonation({ sessionId, actor, schoolId: schoolAId });
    expect(await resolveActiveTarget(sessionId)).toEqual({ targetTenantId: tenantAId, targetSchoolId: schoolAId });
    const active = await getActiveImpersonation(sessionId);
    expect(active).toMatchObject({ active: true, school: { id: schoolAId }, tenant: { id: tenantAId }, readOnly: true });

    await stopImpersonation({ sessionId, actor });
  });

  it("allows at most one active impersonation per session (explicit stop → start)", async () => {
    const sessionId = await makeSession();
    await startImpersonation({ sessionId, actor, schoolId: schoolAId });
    await expect(startImpersonation({ sessionId, actor, schoolId: schoolBId })).rejects.toMatchObject({ code: "IMPERSONATION_ACTIVE" });
    // After stopping, a new target can start.
    await stopImpersonation({ sessionId, actor });
    const state = await startImpersonation({ sessionId, actor, schoolId: schoolBId });
    expect(state.active).toBe(true);
    await stopImpersonation({ sessionId, actor });
  });

  it("derives the tenant from the target school (cross-tenant): no client tenant injection", async () => {
    const sessionId = await makeSession();
    // Caller only supplies a schoolId belonging to tenant B; the tenant is derived.
    const state = await startImpersonation({ sessionId, actor, schoolId: schoolBId });
    if (state.active) expect(state.tenant.id).toBe(tenantBId);
    expect(await resolveActiveTarget(sessionId)).toEqual({ targetTenantId: tenantBId, targetSchoolId: schoolBId });
    await stopImpersonation({ sessionId, actor });
  });

  it("rejects an ineligible (ARCHIVED) target and an unknown school", async () => {
    const sessionId = await makeSession();
    await expect(startImpersonation({ sessionId, actor, schoolId: archivedSchoolId })).rejects.toMatchObject({ code: "IMPERSONATION_TARGET_INELIGIBLE" });
    await expect(startImpersonation({ sessionId, actor, schoolId: "does-not-exist" })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await resolveActiveTarget(sessionId)).toBeNull(); // nothing was created
  });

  it("stop clears the context + audits IMPERSONATION_ENDED; a second stop is a no-op", async () => {
    const sessionId = await makeSession();
    await startImpersonation({ sessionId, actor, schoolId: schoolAId });
    const stopped = await stopImpersonation({ sessionId, actor });
    expect(stopped).toEqual({ active: false });
    expect(await prisma.platformImpersonation.findUnique({ where: { sessionId } })).toBeNull();
    const ended = await prisma.auditEvent.findFirst({ where: { entityId: schoolAId, action: "IMPERSONATION_ENDED" } });
    expect(ended).not.toBeNull();
    // Idempotent.
    expect(await stopImpersonation({ sessionId, actor })).toEqual({ active: false });
  });

  it("fails closed if the target is archived AFTER start (resolver + state)", async () => {
    const sessionId = await makeSession();
    // A throwaway school we can archive without affecting other tests.
    const tmp = await prisma.school.create({ data: { tenantId: tenantAId, name: `${NS} Tmp`, code: `${NS}-TMP-${stamp}`, status: "ACTIVE" }, select: { id: true } });
    await startImpersonation({ sessionId, actor, schoolId: tmp.id });
    expect(await resolveActiveTarget(sessionId)).not.toBeNull();

    await prisma.school.update({ where: { id: tmp.id }, data: { status: "ARCHIVED" } });
    expect(await resolveActiveTarget(sessionId)).toBeNull(); // collapses to platform mode
    expect(await getActiveImpersonation(sessionId)).toEqual({ active: false });

    await stopImpersonation({ sessionId, actor });
    await prisma.school.delete({ where: { id: tmp.id } });
  });

  it("session teardown (logout / expiry) cascade-removes the context row", async () => {
    const sessionId = await makeSession();
    await startImpersonation({ sessionId, actor, schoolId: schoolAId });
    expect(await prisma.platformImpersonation.findUnique({ where: { sessionId } })).not.toBeNull();
    // Deleting the session (what logout does) must remove the impersonation row.
    await prisma.session.delete({ where: { id: sessionId } });
    expect(await prisma.platformImpersonation.findFirst({ where: { sessionId } })).toBeNull();
  });

  it("requireOrgScope derives the target scope while impersonating (server-authoritative)", async () => {
    // Build the context the authz layer would produce while impersonating school A.
    const ctx = {
      user: { id: actor.id, name: actor.name },
      impersonation: { targetTenantId: tenantAId, targetSchoolId: schoolAId },
      schoolId: schoolAId,
    } as unknown as AuthzContext;
    const scope = await requireOrgScope(ctx);
    expect(scope).toMatchObject({ tenantId: tenantAId, schoolId: schoolAId, branchId: null, academicSessionId: null });
    expect(scope.actor.id).toBe(actor.id); // actor identity is always the platform admin

    // If the target vanished, the scope fails closed.
    const gone = { ...ctx, impersonation: { targetTenantId: tenantAId, targetSchoolId: "gone" } } as unknown as AuthzContext;
    await expect(requireOrgScope(gone)).rejects.toMatchObject({ code: "INVALID_SCHOOL" });
  });
});

describe("impersonation read-only permission model (pure)", () => {
  it("the inspection set is READS ONLY — every `.view`, no writes, no platform.*", () => {
    // Representative reads present.
    for (const k of ["students.view", "admissions.view", "guardians.view", "academics.view", "fees.view"]) {
      expect(INSPECTION_PERMISSION_KEYS).toContain(k);
    }
    // No write/mutation permission can ever leak in.
    for (const k of ["students.create", "students.update", "students.archive", "students.export", "admissions.approve", "fees.collect", "fees.refund", "attendance.mark", "academics.manage", "settings.manage"]) {
      expect(INSPECTION_PERMISSION_KEYS).not.toContain(k);
    }
    // Purely tenant reads — never platform keys or the umbrella gate.
    expect(INSPECTION_PERMISSION_KEYS.every((k) => k.endsWith(".view") && !k.startsWith("platform.") && k !== "super_admin.access")).toBe(true);
  });

  it("the effective impersonation set = platform perms + reads: retains identity + stop, denies writes", () => {
    // This mirrors getAuthzContext's override for a SUPER_ADMIN inspecting a school.
    const permissions = new Set<string>([...platformPermissionsForRole("SUPER_ADMIN"), ...INSPECTION_PERMISSION_KEYS]);
    // Read inspection allowed.
    expect(permissions.has("students.view")).toBe(true);
    expect(permissions.has("admissions.view")).toBe(true);
    // Platform identity retained — including the ability to STOP.
    expect(permissions.has("platform.impersonation.manage")).toBe(true);
    expect(permissions.has("platform.schools.view")).toBe(true);
    // Tenant writes denied — the actor never becomes SCHOOL_ADMIN.
    expect(permissions.has("students.create")).toBe(false);
    expect(permissions.has("students.update")).toBe(false);
    expect(permissions.has("admissions.approve")).toBe(false);
    expect(permissions.has("fees.collect")).toBe(false);
    expect(permissions.has("attendance.mark")).toBe(false);
  });

  it("platform.impersonation.manage is SUPER_ADMIN-only and never a tenant permission", () => {
    expect(PLATFORM_ROLE_PERMISSIONS.SUPER_ADMIN).toContain("platform.impersonation.manage");
    for (const role of ["SUPPORT", "BILLING", "AUDITOR"]) {
      expect(PLATFORM_ROLE_PERMISSIONS[role] ?? []).not.toContain("platform.impersonation.manage");
    }
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      expect(perms).not.toContain("platform.impersonation.manage");
    }
    // Also confirmed via the resolver used by the real authz layer.
    expect(platformPermissionsForRole("SUPER_ADMIN")).toContain("platform.impersonation.manage");
    expect(platformPermissionsForRole("AUDITOR")).not.toContain("platform.impersonation.manage");
  });
});
