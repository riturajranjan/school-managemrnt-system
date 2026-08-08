"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/server/audit";
import { resolvePostLoginDestination } from "@/lib/server/auth/onboarding";
import { safeNext } from "@/lib/server/auth/safe-redirect";
import { checkLoginRate, registerFailure, registerSuccess } from "@/lib/server/auth/rate-limit";

// ---------------------------------------------------------------------------
// Authentication Server Actions. All credential handling lives here on the
// server — never in a React component. Every failure returns a GENERIC message
// (no account enumeration); the real reason is only ever recorded server-side
// in the audit log. Redirect targets are open-redirect validated.
// ---------------------------------------------------------------------------

export type LoginState = { error?: string } | undefined;

const GENERIC_INVALID = "Invalid email or password.";

const loginSchema = z.object({
  identifier: z.string().trim().min(1),
  password: z.string().min(1),
  next: z.string().optional(),
});

async function clientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : h.get("x-real-ip");
}

// Signs a user in with email + password. On success the Better Auth session
// cookie is set (nextCookies plugin) and we redirect to the resolved next step.
export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { error: GENERIC_INVALID };

  const { identifier, password, next } = parsed.data;
  const email = identifier.toLowerCase();
  const ip = await clientIp();

  // Rate limit by ip + email so neither dimension alone can be abused.
  const rateKey = `${ip ?? "noip"}:${email}`;
  const rate = checkLoginRate(rateKey);
  if (!rate.allowed) {
    return { error: `Too many attempts. Try again in about ${Math.ceil((rate.retryAfterSec ?? 900) / 60)} minute(s).` };
  }

  // Only real email identifiers are supported by credential auth today. A
  // non-email identifier simply fails as invalid credentials (no enumeration).
  const isEmail = z.email().safeParse(email).success;

  let userId: string | null = null;
  if (isEmail) {
    try {
      const res = await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
      userId = res?.user?.id ?? null;
    } catch (err) {
      if (!(err instanceof APIError)) throw err; // unexpected → surface as 500
      userId = null;
    }
  }

  if (!userId) {
    registerFailure(rateKey);
    await recordAudit({ action: "auth.login.failure", entityType: "User", metadata: { email, ip } }).catch(() => {});
    return { error: GENERIC_INVALID };
  }

  // Enforce account status server-side. A restricted account gets NO usable
  // session: revoke everything before bouncing to the restricted page.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { status: true } });
  if (user && (user.status === "SUSPENDED" || user.status === "DEACTIVATED")) {
    await prisma.session.deleteMany({ where: { userId } });
    await recordAudit({ actorUserId: userId, action: "auth.login.blocked", entityType: "User", metadata: { status: user.status, ip } }).catch(() => {});
    redirect("/account-locked");
  }

  registerSuccess(rateKey);
  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } }).catch(() => {});
  await recordAudit({ actorUserId: userId, action: "auth.login.success", entityType: "User", metadata: { ip } }).catch(() => {});

  const dest = safeNext(next, await resolvePostLoginDestination(userId));
  redirect(dest); // throws NEXT_REDIRECT — must stay outside any try/catch
}

// Destroys the current session and returns to /login. Safe to call even with no
// active session.
export async function logoutAction(): Promise<void> {
  const h = await headers();
  let userId: string | null = null;
  try {
    const session = await auth.api.getSession({ headers: h });
    userId = session?.user?.id ?? null;
    await auth.api.signOut({ headers: h });
  } catch {
    // Ignore — we still clear and redirect below.
  }
  if (userId) {
    await recordAudit({ actorUserId: userId, action: "auth.logout", entityType: "User" }).catch(() => {});
  }
  redirect("/login");
}

// ---------------------------------------------------------------------------
// DEV-ONLY demo login. Signs in a REAL seeded account using the server-side dev
// password — it never bypasses Better Auth and never touches localStorage. It
// is a no-op outside development / when demo access is disabled.
// ---------------------------------------------------------------------------
// Internal (not exported): a "use server" module may only export async actions.
function demoAccessEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.DEMO_ACCESS !== "false";
}

export async function devDemoLoginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!demoAccessEnabled()) return { error: "Demo access is disabled." };
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  if (!email) return { error: "Missing demo account." };

  const password = process.env.SEED_DEMO_PASSWORD ?? "Novyra@Dev123";
  let userId: string | null = null;
  try {
    const res = await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
    userId = res?.user?.id ?? null;
  } catch (err) {
    if (!(err instanceof APIError)) throw err;
    return { error: "Demo account is not seeded. Run `npm run db:seed`." };
  }
  if (!userId) return { error: "Demo account is not seeded. Run `npm run db:seed`." };

  await recordAudit({ actorUserId: userId, action: "auth.login.demo", entityType: "User" }).catch(() => {});
  redirect(await resolvePostLoginDestination(userId));
}
