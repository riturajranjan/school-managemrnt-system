// Data Access Layer — the authoritative auth boundary.
//
// `requireUser()` resolves and validates the real server session (existence,
// expiry, and current account status via getCurrentUser → resolveSessionUser)
// and redirects to /login when there is no valid, ACTIVE user. Used by the root
// layout (all protected routes) and the /super-admin layout.
//
// `getUser` is wrapped in React `cache()` so multiple calls within one request
// (layout + page) share a single session lookup.
import { cache } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "./current-user";
import type { SafeUser } from "./service";

/** Request-deduped current-user lookup (safe fields only). */
export const getUser = cache(getCurrentUser);

/** Require a valid, ACTIVE session; redirect to /login otherwise. */
export async function requireUser(): Promise<SafeUser> {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Require a real platform admin (a PlatformAdmin row — never derived from a
 * tenant role). Redirects unauthenticated → /login, non-platform → /access-denied.
 * This is the server-side gate for /super-admin/* (UI hiding is not security).
 */
export async function requirePlatformAdmin(): Promise<SafeUser> {
  const user = await requireUser();
  if (!user.isPlatformAdmin) redirect("/access-denied");
  return user;
}
