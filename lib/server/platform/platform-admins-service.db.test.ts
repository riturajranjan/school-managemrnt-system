// Platform admins DB-integration tests (Super Admin SA-4N). Invite (real
// INVITED user + PlatformAdmin, honest invitePending), duplicate rejection, role
// update, suspend/reactivate, and RBAC. Namespaced ("@t4nadm.test").
//
// NOTE: the "cannot demote/suspend the LAST active super admin" invariant is
// enforced in the service via a GLOBAL active-super-admin count (see
// updateAdmin/setAdminStatus). It is not isolatable in the shared parallel test
// DB (the seed + other suites contribute active super admins), so it is covered
// by code review + the manual test — not asserted here to avoid touching shared
// super-admin rows.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import {
  getAdmin,
  inviteAdmin,
  listAdmins,
  setAdminStatus,
  updateAdmin,
} from "@/lib/server/platform/platform-admins-service";
import { platformPermissionsForRole, ROLE_PERMISSIONS } from "@/lib/server/authz/catalog";

let dbReady = false;
try {
  dbReady = Boolean(await prisma.role.findFirst({ where: { key: "SCHOOL_ADMIN", isSystem: true } }));
} catch {
  dbReady = false;
}

const NS = "T4NADM";
const stamp = Date.now().toString(36);
const actor = { id: "t4nadm-actor", name: "T4NADM Tester" };
const email = (s: string) => `${NS.toLowerCase()}.${stamp}.${s}@t4nadm.test`;

beforeAll(async () => {
  if (!dbReady) return;
});

afterAll(async () => {
  if (!dbReady) return;
  await prisma.auditEvent.deleteMany({ where: { actorUserId: actor.id } });
  await prisma.user.deleteMany({ where: { email: { endsWith: "@t4nadm.test" } } }); // cascades PlatformAdmin
});

describe.skipIf(!dbReady)("platform admins service (DB)", () => {
  it("invites an admin: creates an INVITED user + PlatformAdmin, invitePending true; rejects duplicates", async () => {
    const a = await inviteAdmin(actor, { name: "Sam Support", email: email("support"), role: "SUPPORT" });
    expect(a).toMatchObject({ role: "SUPPORT", status: "active", invitePending: true });
    expect(a.email).toBe(email("support"));

    const user = await prisma.user.findUnique({ where: { email: email("support") }, select: { status: true, passwordSetupRequired: true } });
    expect(user).toMatchObject({ status: "INVITED", passwordSetupRequired: true });

    // Duplicate: same email already a platform admin.
    await expect(inviteAdmin(actor, { name: "dup", email: email("support"), role: "BILLING" })).rejects.toMatchObject({ code: "CONFLICT" });

    const audit = await prisma.auditEvent.findFirst({ where: { entityId: a.id, action: "PLATFORM_ADMIN_INVITED" } });
    expect(audit).not.toBeNull();
  });

  it("updates role and toggles status (suspend → reactivate) for a non-super-admin", async () => {
    const a = await inviteAdmin(actor, { name: "Bea Billing", email: email("billing"), role: "BILLING" });
    const updated = await updateAdmin(actor, a.id, { role: "AUDITOR" });
    expect(updated.role).toBe("AUDITOR");

    const suspended = await setAdminStatus(actor, a.id, "suspended");
    expect(suspended.status).toBe("suspended");
    const reactivated = await setAdminStatus(actor, a.id, "active");
    expect(reactivated.status).toBe("active");
  });

  it("lists + filters admins and rejects an unknown id", async () => {
    await inviteAdmin(actor, { name: "Fil Ter", email: email("filter"), role: "SUPPORT" });
    const all = await listAdmins({});
    expect(all.some((x) => x.email === email("filter"))).toBe(true);
    const supportOnly = await listAdmins({ role: "SUPPORT" });
    expect(supportOnly.every((x) => x.role === "SUPPORT")).toBe(true);
    const searched = await listAdmins({ search: "Fil Ter" });
    expect(searched.some((x) => x.email === email("filter"))).toBe(true);
    await expect(getAdmin("nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("RBAC: platform.admins.* is SUPER_ADMIN-manage / AUDITOR-view, denied to school + SUPPORT/BILLING", () => {
    expect(platformPermissionsForRole("SUPER_ADMIN")).toContain("platform.admins.manage");
    expect(platformPermissionsForRole("AUDITOR")).toContain("platform.admins.view");
    expect(platformPermissionsForRole("AUDITOR")).not.toContain("platform.admins.manage");
    expect(platformPermissionsForRole("SUPPORT")).not.toContain("platform.admins.manage");
    expect(platformPermissionsForRole("BILLING")).not.toContain("platform.admins.manage");
    for (const perms of Object.values(ROLE_PERMISSIONS)) {
      expect(perms).not.toContain("platform.admins.view");
      expect(perms).not.toContain("platform.admins.manage");
    }
  });
});
