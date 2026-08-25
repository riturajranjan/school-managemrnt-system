// Permission-matrix regression for the system-wide RBAC + UI enforcement phase.
// Verifies, against the real seed and real resolver (not a mock), that the
// specific catalog keys now driving frontend visibility (sidebar/nav-config,
// page-level view gates, quick create) resolve the way the UI assumes for
// representative read-only / no-permission / manager personas. Sibling to
// permissions.db.test.ts — same read-only, skip-if-DB-unreachable convention.
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { resolveUserAuthz } from "@/lib/server/authz/permissions";

let dbReady = false;
try {
  const admin = await prisma.user.findUnique({ where: { email: "admin@novyra-demo.example" } });
  dbReady = Boolean(admin);
} catch {
  dbReady = false;
}

async function permsFor(email: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    select: { id: true, platformAdmin: { select: { id: true } } },
  });
  const ctx = await resolveUserAuthz(user.id, Boolean(user.platformAdmin));
  return ctx.permissions;
}

describe.skipIf(!dbReady)("nav/page permission matrix (DB)", () => {
  it("SCHOOL_ADMIN (manager persona): full mutation rights on core ops modules", async () => {
    const p = await permsFor("admin@novyra-demo.example");
    expect(p.has("students.create")).toBe(true);
    expect(p.has("fees.collect")).toBe(true);
    expect(p.has("accounting.post")).toBe(true);
    expect(p.has("payroll.pay")).toBe(true);
    expect(p.has("settings.manage")).toBe(true);
    expect(p.has("users.manage")).toBe(true);
    // Real catalog keys the new nav-config depends on that aren't in the
    // legacy client-only Permission union at all — must resolve server-side.
    expect(p.has("guardians.view")).toBe(true);
    expect(p.has("curriculum.manage")).toBe(true);
    // SCHOOL_ADMIN deliberately does NOT hold every module's manage key —
    // hr.manage/activities.manage are delegated to HR_ADMIN/ACTIVITY_COORDINATOR.
    expect(p.has("hr.manage")).toBe(false);
    expect(p.has("activities.manage")).toBe(false);
  });

  it("PRINCIPAL (read-only persona): view-only on finance/health/hostel/cafeteria — no mutation", async () => {
    const p = await permsFor("principal@novyra-demo.example");
    for (const key of ["fees.view", "accounting.view", "payroll.view", "health.view", "hostel.view", "cafeteria.view", "settings.view", "guardians.view"]) {
      expect(p.has(key), `expected PRINCIPAL to have ${key}`).toBe(true);
    }
    for (const key of ["fees.manage", "fees.collect", "fees.refund", "accounting.manage", "accounting.post", "accounting.reverse", "payroll.manage", "payroll.finalize", "payroll.pay", "health.manage", "hostel.manage", "cafeteria.manage", "settings.manage", "students.create"]) {
      expect(p.has(key), `expected PRINCIPAL to lack ${key}`).toBe(false);
    }
  });

  it("PRINCIPAL (no-permission persona for library/transport/hr): sidebar items must hide entirely", async () => {
    const p = await permsFor("principal@novyra-demo.example");
    expect(p.has("library.view")).toBe(false);
    expect(p.has("transport.view")).toBe(false);
    expect(p.has("hr.view")).toBe(false);
  });

  it("LIBRARIAN (module-scoped manager persona): full library rights, nothing outside it", async () => {
    const p = await permsFor("librarian@novyra-demo.example");
    expect(p.has("library.view")).toBe(true);
    expect(p.has("library.manage")).toBe(true);
    expect(p.has("students.view")).toBe(true);
    for (const key of ["fees.view", "hr.view", "settings.view", "accounting.view", "payroll.view", "transport.view"]) {
      expect(p.has(key), `expected LIBRARIAN to lack ${key}`).toBe(false);
    }
  });

  it("TEACHER (narrow persona): academics-adjacent view/manage, no finance/settings/admin", async () => {
    const p = await permsFor("teacher@novyra-demo.example");
    expect(p.has("students.view")).toBe(true);
    expect(p.has("guardians.view")).toBe(true);
    expect(p.has("homework.manage")).toBe(true);
    expect(p.has("curriculum.view")).toBe(true);
    for (const key of ["settings.view", "fees.view", "accounting.view", "payroll.view", "students.create", "users.manage"]) {
      expect(p.has(key), `expected TEACHER to lack ${key}`).toBe(false);
    }
  });

  it("sensitive permissions stay separate from their base view permission (health, counseling)", async () => {
    const admin = await permsFor("admin@novyra-demo.example");
    const principal = await permsFor("principal@novyra-demo.example");
    // SCHOOL_ADMIN holds the sensitive tier explicitly (health.viewSensitive).
    expect(admin.has("health.view")).toBe(true);
    expect(admin.has("health.viewSensitive")).toBe(true);
    // PRINCIPAL holds health.view but the catalog never grants viewSensitive
    // alongside it implicitly — ordinary view permission must never imply it.
    expect(principal.has("health.view")).toBe(true);
    expect(principal.has("health.viewSensitive")).toBe(false);
    // Neither role holds counseling.viewConfidential (counselor-owned tier only).
    expect(admin.has("counseling.viewConfidential")).toBe(false);
    expect(principal.has("counseling.viewConfidential")).toBe(false);
  });
});
