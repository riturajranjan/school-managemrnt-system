// Auth session configuration — shared by the login action and current-user helper.
// Batch 2 (real login). Kept tiny; expiry/rotation policy will grow in Batch 3.

/** Name of the httpOnly session cookie. Not a secret — the value it holds is. */
export const SESSION_COOKIE_NAME = "novyra_session";

/** Session lifetime: 30 days. */
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

/**
 * Cookie options for the session cookie. `secure` is on in production only so
 * local http dev still works; the token is never exposed to client JS (httpOnly).
 */
export function sessionCookieOptions(maxAgeSeconds: number = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
