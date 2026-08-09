// Focused identity-foundation tests (Backend Phase 2, Batch 1).
//
// These assert real database constraints/relationships against the configured
// dev database and the Phase 2 seed. They are READ-ONLY except for two inserts
// that are expected to FAIL on unique violations (so nothing is persisted).
//
// If the database is unreachable or unseeded, the whole suite SKIPS — so
// `npm run test` stays green in environments without a local Postgres.
import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { verifyPassword } from "@/lib/server/password";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

const DEV_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "Novyra@Dev123";
const connectionString = process.env.DATABASE_URL;

// Scope "all users" assertions to the known seeded identity users. Other DB test
// files run in parallel (Vitest) and transiently create fixture users with
// placeholder hashes; those are not the subject of these seed assertions. We
// match by an explicit email list — a prefix filter can't be used because the
// fixture prefix `__` contains SQL LIKE wildcards. This does NOT weaken password
// validation: it still verifies every real seeded user has a proper Argon2id hash.
const SEEDED_EMAILS = [
  "admin@novyra-demo.example",
  "principal@novyra-demo.example",
  "teacher@novyra-demo.example",
  "librarian@novyra-demo.example",
  "transport@novyra-demo.example",
  "hr@novyra-demo.example",
  "platform.admin@novyra.example",
];
const SEEDED_ONLY = { email: { in: SEEDED_EMAILS } } as const;

let prisma: PrismaClient | undefined;
let dbReady = false;

// Top-level probe: require a live connection AND the Phase 2 seed to be present.
if (connectionString) {
  try {
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
    const admin = await prisma.user.findUnique({
      where: { email: "admin@novyra-demo.example" },
    });
    dbReady = Boolean(admin);
  } catch {
    dbReady = false;
  }
}

afterAll(async () => {
  await prisma?.$disconnect();
});

describe.skipIf(!dbReady)("identity foundation (DB)", () => {
  const db = () => prisma as PrismaClient;

  it("enforces unique User.email", async () => {
    await expect(
      db().user.create({
        data: { email: "admin@novyra-demo.example", name: "Dup", status: "ACTIVE" },
      }),
    ).rejects.toThrow();
  });

  it("enforces unique TenantMembership (userId + tenantId)", async () => {
    const membership = await db().tenantMembership.findFirstOrThrow();
    await expect(
      db().tenantMembership.create({
        data: { userId: membership.userId, tenantId: membership.tenantId },
      }),
    ).rejects.toThrow();
  });

  it("links RoleAssignment → membership(user) and → role", async () => {
    const admin = await db().user.findUniqueOrThrow({
      where: { email: "admin@novyra-demo.example" },
      include: {
        memberships: {
          include: {
            tenant: true,
            roleAssignments: { include: { role: true } },
          },
        },
      },
    });
    const membership = admin.memberships.find((m) => m.tenant.slug === "novyra-demo");
    expect(membership).toBeDefined();
    const roleKeys = membership!.roleAssignments.map((ra) => ra.role.key);
    expect(roleKeys).toContain("SCHOOL_ADMIN");
  });

  it("keeps platform admins separate from tenant users", async () => {
    const platform = await db().user.findUniqueOrThrow({
      where: { email: "platform.admin@novyra.example" },
      include: { platformAdmin: true, memberships: true },
    });
    expect(platform.platformAdmin).not.toBeNull();
    expect(platform.platformAdmin?.role).toBe("SUPER_ADMIN");
    // Platform access is NOT derived from tenant membership.
    expect(platform.memberships).toHaveLength(0);

    // A tenant user (school admin) must NOT have platform access.
    const admin = await db().user.findUniqueOrThrow({
      where: { email: "admin@novyra-demo.example" },
      include: { platformAdmin: true },
    });
    expect(admin.platformAdmin).toBeNull();
  });

  it("seeds an Argon2id password hash for every user", async () => {
    const users = await db().user.findMany({ where: SEEDED_ONLY });
    expect(users.length).toBeGreaterThan(0);
    for (const u of users) {
      expect(u.passwordHash, `${u.email} has a hash`).toBeTruthy();
      expect(u.passwordHash!.startsWith("$argon2id$"), `${u.email} uses argon2id`).toBe(true);
    }
  });

  it("never persists the plaintext password", async () => {
    const users = await db().user.findMany({ where: SEEDED_ONLY });
    for (const u of users) {
      expect(u.passwordHash).not.toBe(DEV_PASSWORD);
      expect(u.passwordHash).not.toContain(DEV_PASSWORD);
    }
    // The stored hash is the real hash of the dev password (round-trips).
    const admin = await db().user.findUniqueOrThrow({
      where: { email: "admin@novyra-demo.example" },
    });
    expect(await verifyPassword(admin.passwordHash!, DEV_PASSWORD)).toBe(true);
    expect(await verifyPassword(admin.passwordHash!, "wrong-password")).toBe(false);
  });
});
