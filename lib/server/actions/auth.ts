"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { recordAudit } from "@/lib/server/audit";
import { authenticateCredentials, LOGIN_ERROR_COPY, resolveSimplePostLoginDestination } from "@/lib/server/auth/credentials";

// ---------------------------------------------------------------------------
// Authentication Server Actions. All credential handling lives here on the
// server — never in a React component. Every failure returns a GENERIC message
// (no account enumeration); the real reason is only ever recorded server-side
// in the audit log. Redirect targets are open-redirect validated.
// ---------------------------------------------------------------------------

export type LoginState = { error?: string } | undefined;

const GENERIC_INVALID = "Invalid email or password.";

async function clientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : h.get("x-real-ip");
}

// Signs a user in with email + password. On success the Better Auth session
// cookie is set (nextCookies plugin) and we redirect to the resolved next step.
export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const h = await headers();
  const result = await authenticateCredentials({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
    headers: h,
    ipAddress: await clientIp(),
  });

  if (!result.success) {
    if (result.errorCode === "RATE_LIMITED") {
      return { error: `Too many attempts. Try again in about ${Math.ceil((result.retryAfterSec ?? 900) / 60)} minute(s).` };
    }
    return { error: result.errorCode === "INVALID_CREDENTIALS" ? GENERIC_INVALID : LOGIN_ERROR_COPY[result.errorCode] };
  }

  redirect(result.redirectTo); // throws NEXT_REDIRECT — must stay outside any try/catch
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
  const h = await headers();
  const result = await authenticateCredentials({ identifier: email, password, headers: h, ipAddress: await clientIp() });
  if (!result.success) return { error: result.errorCode === "INVALID_CREDENTIALS" ? "Demo account is not seeded. Run `npm run db:seed`." : LOGIN_ERROR_COPY[result.errorCode] };

  await recordAudit({ actorUserId: result.userId, action: "auth.login.demo", entityType: "User" }).catch(() => {});
  redirect(await resolveSimplePostLoginDestination(result.userId));
}
