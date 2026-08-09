"use server";

// Auth Server Actions — the single real entry points for login and logout.
// Return only safe UI info (never the session token, hash, or DB internals).
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authenticateWithPassword, destroySession } from "@/lib/server/auth/service";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/server/auth/config";
import { sanitizeReturnTo } from "@/lib/server/auth/routes";
import { resolvePostLogin } from "@/lib/server/context/resolver";

export type LoginActionResult =
  | { success: true; redirectTo: string }
  | { success: false; errorCode: "VALIDATION_ERROR" | "INVALID_CREDENTIALS" | "ACCOUNT_INACTIVE" | "SERVER_ERROR" };

export async function loginAction(input: {
  email: string;
  password: string;
  returnTo?: string | null;
}): Promise<LoginActionResult> {
  const result = await authenticateWithPassword(input);
  if (!result.ok) {
    return { success: false, errorCode: result.errorCode };
  }

  const store = await cookies();
  const maxAge = Math.max(1, Math.floor((result.expiresAt.getTime() - Date.now()) / 1000));
  // httpOnly cookie — the token is never readable from client JS.
  store.set(SESSION_COOKIE_NAME, result.token, sessionCookieOptions(maxAge));

  // Run the centralized resolver (auto-selects context, else routes to a
  // selector). Honor a validated internal returnTo only when the workspace is
  // fully resolved (not mid-selection / access-denied).
  const resolved = await resolvePostLogin(result.user.id);
  const ready = !resolved.startsWith("/select-") && resolved !== "/access-denied" && resolved !== "/login";
  const redirectTo = (ready && sanitizeReturnTo(input.returnTo)) || resolved;
  return { success: true, redirectTo };
}

/**
 * Real logout: invalidate the server session (delete the row), clear the auth
 * cookie with matching attributes, then redirect to /login. Not a client-only
 * localStorage clear — a replayed cookie will no longer authenticate.
 */
export async function logout(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  await destroySession(token);
  // Clear with matching path/attributes so no stale cookie remains.
  store.set(SESSION_COOKIE_NAME, "", sessionCookieOptions(0));
  redirect("/login");
}
