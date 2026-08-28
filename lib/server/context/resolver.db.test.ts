// resolvePostLogin against real data (production login/role-resolution audit).
// This is the actual function the real login Server Action calls to compute
// where a just-authenticated user lands — see app/(auth)/actions.ts. Read-only
// except for a temp `__test__%` user, cleaned up in afterAll. Skips entirely
// if the database is unreachable/unseeded.
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { resolvePostLogin } from "@/lib/server/context/resolver";

let dbReady = false;
try {
  const admin = await prisma.user.findUnique({ where: { email: "admin@novyra-demo.example" } });
  dbReady = Boolean(admin);
} catch {
  dbReady = false;
}

afterAll(async () => {
  if (!dbReady) return;
  await prisma.user.deleteMany({ where: { email: { startsWith: "__test__resolver" } } });
  await prisma.$disconnect();
});

describe.skipIf(!dbReady)("resolvePostLogin (DB)", () => {
  it("routes a real PlatformAdmin straight to /super-admin/dashboard — zero TenantMemberships required, matching a freshly bootstrapped production DB (Tenants=0/Schools=0)", async () => {
    // The seeded platform admin (see prisma/seed.ts) intentionally has NO
    // TenantMembership at all — this is exactly the production shape: a
    // Platform Super Admin created by prisma/bootstrap-production.ts before
    // any School exists. If this ever regressed to check memberships/schools
    // before the platformAdmin relation, this user would 404 into
    // /access-denied instead.
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: "platform.admin@novyra.example" },
      select: { id: true, memberships: { where: { status: "ACTIVE" } } },
    });
    expect(user.memberships).toHaveLength(0);
    expect(await resolvePostLogin(user.id)).toBe("/super-admin/dashboard");
  });

  it("a non-platform-admin user with zero active memberships resolves to /access-denied (never guessed as a role, never crashes)", async () => {
    const user = await prisma.user.create({
      data: { email: "__test__resolver-orphan@novyra.example", name: "Test Orphan", status: "ACTIVE" },
    });
    expect(await resolvePostLogin(user.id)).toBe("/access-denied");
  });

  it("an unknown userId resolves to /login rather than throwing", async () => {
    expect(await resolvePostLogin("not-a-real-user-id")).toBe("/login");
  });
});
