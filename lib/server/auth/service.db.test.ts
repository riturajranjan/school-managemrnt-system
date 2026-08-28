// Login/session tests (Backend Phase 2, Batch 2) — real password auth against
// the dev database. READ-ONLY except for temp `__test__%` users and the sessions
// created by successful logins, all cleaned up in afterAll. Skips entirely if the
// database is unreachable/unseeded, so `npm run test` stays green without Postgres.
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { hashPassword } from "@/lib/server/password";
import { hashToken } from "@/lib/server/auth/tokens";
import {
  authenticateWithPassword,
  destroySession,
  landingForLogin,
  resolveSessionUser,
} from "@/lib/server/auth/service";
import { DEMO_ACCOUNTS } from "@/lib/types/auth";

const DEV_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "Novyra@Dev123";
const TEST_PASSWORD = "TestPass@123";

// Probe: require a live connection AND the Phase 2 seed.
let dbReady = false;
try {
  const admin = await prisma.user.findUnique({ where: { email: "admin@novyra-demo.example" } });
  dbReady = Boolean(admin);
} catch {
  dbReady = false;
}

// Track session tokens created by successful logins so we can clean them up.
const createdTokenHashes: string[] = [];

afterAll(async () => {
  if (!dbReady) return;
  if (createdTokenHashes.length) {
    await prisma.session.deleteMany({ where: { tokenHash: { in: createdTokenHashes } } });
  }
  // Temp users (and their sessions via cascade).
  await prisma.user.deleteMany({ where: { email: { startsWith: "__test__" } } });
  await prisma.$disconnect();
});

describe.skipIf(!dbReady)("password login + session (DB)", () => {
  async function makeUser(email: string, status: "LOCKED" | "SUSPENDED" | "INVITED" | "ACTIVE") {
    return prisma.user.create({
      data: { email, name: `Test ${status}`, status, passwordHash: await hashPassword(TEST_PASSWORD) },
    });
  }

  it("logs in a valid ACTIVE user and returns a safe result", async () => {
    const result = await authenticateWithPassword({
      email: "admin@novyra-demo.example",
      password: DEV_PASSWORD,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    createdTokenHashes.push(hashToken(result.token));

    expect(result.user.email).toBe("admin@novyra-demo.example");
    expect(result.redirectTo).toBe("/"); // School Admin → existing root dashboard
    expect(result.token).toBeTruthy();
    // Safe result never leaks the hash.
    expect(result.user).not.toHaveProperty("passwordHash");
    // Token is not the password, and only its hash is persisted.
    expect(result.token).not.toBe(DEV_PASSWORD);
    const row = await prisma.session.findUnique({ where: { tokenHash: hashToken(result.token) } });
    expect(row).not.toBeNull();
    expect(row!.tokenHash).not.toBe(result.token);
  });

  it("routes a platform admin to /super-admin/dashboard", async () => {
    const result = await authenticateWithPassword({
      email: "platform.admin@novyra.example",
      password: DEV_PASSWORD,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    createdTokenHashes.push(hashToken(result.token));
    expect(result.user.isPlatformAdmin).toBe(true);
    expect(result.redirectTo).toBe("/super-admin/dashboard");
  });

  it("rejects a wrong password with a generic error", async () => {
    const result = await authenticateWithPassword({
      email: "admin@novyra-demo.example",
      password: "definitely-wrong",
    });
    expect(result).toEqual({ ok: false, errorCode: "INVALID_CREDENTIALS" });
  });

  it("rejects an unknown email with the SAME generic error (no enumeration, no mock fallback)", async () => {
    const result = await authenticateWithPassword({
      email: "nobody@nowhere.example",
      password: DEV_PASSWORD,
    });
    expect(result).toEqual({ ok: false, errorCode: "INVALID_CREDENTIALS" });
  });

  it("rejects LOCKED / SUSPENDED / INVITED accounts (with correct password)", async () => {
    await makeUser("__test__locked@novyra.example", "LOCKED");
    await makeUser("__test__suspended@novyra.example", "SUSPENDED");
    await makeUser("__test__invited@novyra.example", "INVITED");
    for (const email of [
      "__test__locked@novyra.example",
      "__test__suspended@novyra.example",
      "__test__invited@novyra.example",
    ]) {
      const result = await authenticateWithPassword({ email, password: TEST_PASSWORD });
      expect(result).toEqual({ ok: false, errorCode: "ACCOUNT_INACTIVE" });
    }
    // A rejected non-ACTIVE login must NOT create a session.
    const sessions = await prisma.session.count({
      where: { user: { email: { startsWith: "__test__" } } },
    });
    expect(sessions).toBe(0);
  });

  it("validates input server-side (empty password → VALIDATION_ERROR, bad email → INVALID_CREDENTIALS)", async () => {
    expect(await authenticateWithPassword({ email: "admin@novyra-demo.example", password: "" })).toEqual({
      ok: false,
      errorCode: "VALIDATION_ERROR",
    });
    expect(await authenticateWithPassword({ email: "not-an-email", password: "x" })).toEqual({
      ok: false,
      errorCode: "INVALID_CREDENTIALS",
    });
  });

  it("resolves the current user from a valid session token", async () => {
    const login = await authenticateWithPassword({
      email: "principal@novyra-demo.example",
      password: DEV_PASSWORD,
    });
    expect(login.ok).toBe(true);
    if (!login.ok) return;
    createdTokenHashes.push(hashToken(login.token));

    const user = await resolveSessionUser(login.token);
    expect(user).not.toBeNull();
    expect(user!.email).toBe("principal@novyra-demo.example");
    expect(user).not.toHaveProperty("passwordHash");
  });

  it("never authenticates a forged/localStorage-style token or an expired session", async () => {
    expect(await resolveSessionUser(undefined)).toBeNull();
    expect(await resolveSessionUser("fake-value-from-localStorage")).toBeNull();

    // Expired session → not authenticated.
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@novyra-demo.example" } });
    const expiredToken = "expired-" + Math.random().toString(36).slice(2);
    const tokenHash = hashToken(expiredToken);
    createdTokenHashes.push(tokenHash);
    await prisma.session.create({
      data: { userId: admin.id, tokenHash, expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await resolveSessionUser(expiredToken)).toBeNull();
  });

  it("computes the authenticated-/login landing route", () => {
    expect(landingForLogin(true)).toBe("/super-admin/dashboard");
    expect(landingForLogin(false)).toBe("/");
  });

  it("logout (destroySession) invalidates the session so the old token no longer authenticates", async () => {
    const login = await authenticateWithPassword({
      email: "teacher@novyra-demo.example",
      password: DEV_PASSWORD,
    });
    expect(login.ok).toBe(true);
    if (!login.ok) return;
    createdTokenHashes.push(hashToken(login.token));

    // Session is valid before logout.
    expect(await resolveSessionUser(login.token)).not.toBeNull();

    await destroySession(login.token);

    // Row is gone and the replayed token is rejected.
    const row = await prisma.session.findUnique({ where: { tokenHash: hashToken(login.token) } });
    expect(row).toBeNull();
    expect(await resolveSessionUser(login.token)).toBeNull();

    // destroySession is a safe no-op when called again / with junk.
    await destroySession(login.token);
    await destroySession(undefined);
  });

  it("has no development-only auth bypass for the login-page Demo Access identities — they authenticate through the exact same real DB lookup as everyone else and fail like any other non-existent account", async () => {
    // The client-side Demo Access panel only prefills the email field (see
    // components/auth/misc.tsx / login-form.tsx) — it must never reach a
    // special-cased server code path. None of these fictional demo emails
    // exist in this DB, in any environment, including production (they are
    // never created by prisma/bootstrap-production.ts).
    for (const account of DEMO_ACCOUNTS) {
      const result = await authenticateWithPassword({ email: account.email, password: "whatever-someone-types" });
      expect(result).toEqual({ ok: false, errorCode: "INVALID_CREDENTIALS" });
    }
  });

  it("rejects a deleted session and a session whose user is gone", async () => {
    // A temp user + session; deleting the user cascades the session away.
    const user = await makeUser("__test__cascade@novyra.example", "ACTIVE");
    const token = "cascade-" + Math.random().toString(36).slice(2);
    await prisma.session.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60_000) },
    });
    expect(await resolveSessionUser(token)).not.toBeNull();
    await prisma.user.delete({ where: { id: user.id } }); // cascade deletes the session
    expect(await resolveSessionUser(token)).toBeNull();
  });
});
