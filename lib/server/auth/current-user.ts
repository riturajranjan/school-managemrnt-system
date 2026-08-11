// Current-user helper — reads the httpOnly session cookie and resolves it to a
// SafeUser via the auth service. Server-only (uses next/headers). Returns only
// safe fields (id, name, email, image, status, isPlatformAdmin) — never a hash.
//
// This is enough session retrieval to verify auth works. Full protected-route
// enforcement and logout belong to Batch 3.
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "./config";
import { resolveSessionContext, resolveSessionUser, type SafeUser } from "./service";

export async function getCurrentUser(): Promise<SafeUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  return resolveSessionUser(token);
}

/**
 * Current request's session identity ({ sessionId, user }) from the httpOnly
 * cookie, or null. Used where the session ROW id is needed (server-authoritative
 * impersonation binds to it), not just the user.
 */
export async function getCurrentSessionContext(): Promise<{ sessionId: string; user: SafeUser } | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  return resolveSessionContext(token);
}
