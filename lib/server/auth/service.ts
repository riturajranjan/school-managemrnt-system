// Authentication service — Batch 2 (real email+password login).
//
// This is the single authoritative password-auth path. It talks to PostgreSQL
// through Prisma and never consults mock users, localStorage, or hardcoded maps.
// No Prisma/hashing logic lives in React components — callers (the login Server
// Action and pages) use the functions here.
//
// Security posture:
//   • Generic INVALID_CREDENTIALS for unknown email OR wrong password (no field
//     disclosure, no account enumeration — a dummy verify runs for unknown users
//     to equalize timing).
//   • passwordHash / tokens are never returned to callers as part of SafeUser.
//   • Passwords and hashes are never logged.
//   • Any unexpected/DB error fails closed (SERVER_ERROR) — never a mock fallback.
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { verifyPassword } from "@/lib/server/password";
import { SESSION_TTL_SECONDS } from "./config";
import { generateSessionToken, hashToken } from "./tokens";

// A fixed valid Argon2id hash used only to spend comparable CPU when the email
// is unknown, so response timing does not reveal whether an account exists.
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$K6S4Apk0yikE/FyPrzsKXA$08JfLstuNrnKNQblT9m4s6xqEp7wCGT6zEJxRVvxpEk";

/** Server-authoritative login input schema. Client validation is UX-only. */
export const loginSchema = z.object({
  email: z.string().trim().min(1).max(320).email(),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Fields safe to expose to the UI. Never includes passwordHash or tokens. */
export type SafeUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  status: string;
  isPlatformAdmin: boolean;
};

export type LoginErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_INACTIVE"
  | "SERVER_ERROR";

export type AuthResult =
  | { ok: true; user: SafeUser; token: string; expiresAt: Date; redirectTo: string }
  | { ok: false; errorCode: LoginErrorCode };

type UserWithAccess = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  status: string;
  passwordHash: string | null;
  platformAdmin: { id: string } | null;
  memberships: { roleAssignments: { role: { key: string } }[] }[];
};

function toSafeUser(user: {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  status: string;
  platformAdmin: { id: string } | null;
}): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    status: user.status,
    isPlatformAdmin: Boolean(user.platformAdmin),
  };
}

/**
 * Simple post-login landing (Batch 2). Full role/school/branch/session
 * resolution is deferred. Note: the spec's "/dashboard" maps to the existing "/"
 * root dashboard (this UI has no /dashboard route).
 */
export function landingPathFor(user: UserWithAccess): string {
  if (user.platformAdmin) return "/super-admin/dashboard";
  const roleKeys = new Set(
    user.memberships.flatMap((m) => m.roleAssignments.map((ra) => ra.role.key)),
  );
  if (roleKeys.has("SCHOOL_ADMIN") || roleKeys.has("PRINCIPAL")) return "/";
  if (roleKeys.has("TEACHER")) return "/teacher/my-day";
  if (roleKeys.has("LIBRARIAN")) return "/library";
  if (roleKeys.has("TRANSPORT_MANAGER")) return "/transport";
  if (roleKeys.has("HR_ADMIN")) return "/hr";
  return "/";
}

/** Landing route for an already-authenticated user opening /login (Batch 2 simple form). */
export function landingForLogin(isPlatformAdmin: boolean): string {
  return isPlatformAdmin ? "/super-admin/dashboard" : "/";
}

/**
 * Authenticate an email+password pair. On success, creates a DB-backed session
 * and returns the raw token (the caller sets the cookie). All failures are safe,
 * generic results — never throws DB internals to the caller.
 */
export async function authenticateWithPassword(rawInput: unknown): Promise<AuthResult> {
  const parsed = loginSchema.safeParse(rawInput);
  if (!parsed.success) {
    // Missing fields → validation; malformed email → treat as invalid credentials.
    const issues = parsed.error.issues;
    const missing = issues.some((i) => i.code === "too_small");
    return { ok: false, errorCode: missing ? "VALIDATION_ERROR" : "INVALID_CREDENTIALS" };
  }

  const email = parsed.data.email.toLowerCase();
  const password = parsed.data.password;

  try {
    const user = (await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        status: true,
        passwordHash: true,
        platformAdmin: { select: { id: true } },
        memberships: {
          where: { status: "ACTIVE" },
          select: { roleAssignments: { select: { role: { select: { key: true } } } } },
        },
      },
    })) as UserWithAccess | null;

    if (!user || !user.passwordHash) {
      // Equalize timing so a missing account is indistinguishable from a wrong password.
      await verifyPassword(DUMMY_HASH, password).catch(() => false);
      return { ok: false, errorCode: "INVALID_CREDENTIALS" };
    }

    const passwordOk = await verifyPassword(user.passwordHash, password);
    if (!passwordOk) return { ok: false, errorCode: "INVALID_CREDENTIALS" };

    // Status is enforced only after the password is verified, so ACCOUNT_INACTIVE
    // is never revealed to someone who does not already hold valid credentials.
    if (user.status !== "ACTIVE") return { ok: false, errorCode: "ACCOUNT_INACTIVE" };

    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
    await prisma.session.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt },
    });

    return {
      ok: true,
      user: toSafeUser(user),
      token,
      expiresAt,
      redirectTo: landingPathFor(user),
    };
  } catch {
    // Fail closed on any DB/unexpected error — no mock fallback, no error details leaked.
    console.error("[auth] authenticateWithPassword failed (see server logs)");
    return { ok: false, errorCode: "SERVER_ERROR" };
  }
}

/**
 * Resolve a raw session token to a SafeUser, or null. Validates existence,
 * expiry, and account status. Fails closed (null) on any error — a forged or
 * client-storage value can never authenticate.
 */
export async function resolveSessionUser(token: string | undefined | null): Promise<SafeUser | null> {
  if (!token) return null;
  try {
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      select: {
        expiresAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            status: true,
            platformAdmin: { select: { id: true } },
          },
        },
      },
    });
    if (!session) return null;
    if (session.expiresAt.getTime() <= Date.now()) return null;
    if (session.user.status !== "ACTIVE") return null;
    return toSafeUser(session.user);
  } catch {
    return null;
  }
}

/**
 * Resolve a raw session token to the SESSION IDENTITY ({ sessionId, user }), or
 * null. Same validation as resolveSessionUser (existence, expiry, ACTIVE user),
 * but also returns the session row id — the anchor that server-authoritative
 * impersonation binds to. Fails closed (null) on any error.
 */
export async function resolveSessionContext(
  token: string | undefined | null,
): Promise<{ sessionId: string; user: SafeUser } | null> {
  if (!token) return null;
  try {
    const session = await prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      select: {
        id: true,
        expiresAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            status: true,
            platformAdmin: { select: { id: true } },
          },
        },
      },
    });
    if (!session) return null;
    if (session.expiresAt.getTime() <= Date.now()) return null;
    if (session.user.status !== "ACTIVE") return null;
    return { sessionId: session.id, user: toSafeUser(session.user) };
  } catch {
    return null;
  }
}

/**
 * Invalidate a server session by deleting its row (revokes it everywhere, so a
 * replayed cookie no longer authenticates). Uses deleteMany so a missing/already
 * removed session is a no-op. Fails closed on error without leaking details.
 */
export async function destroySession(token: string | undefined | null): Promise<void> {
  if (!token) return;
  try {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  } catch {
    // Ignore — the cookie is cleared regardless; a dangling row will expire.
  }
}
