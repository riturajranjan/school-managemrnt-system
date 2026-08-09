// Route classification + redirect-target sanitisation.
//
// Pure module (no DB, no server-only imports) so it can be shared by `proxy.ts`,
// the Data Access Layer, and client code alike.

/**
 * Paths reachable WITHOUT a session: the pre-login auth flows plus the
 * error/status screens that must render when there is no valid session (so we
 * never create a redirect loop). Everything else — all business modules,
 * /super-admin/*, the post-login selectors, first-login — is protected.
 */
export const PUBLIC_PREFIXES = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/verify",
  "/verify-email",
  "/verify-otp",
  "/activate-account",
  "/accept-invite",
  "/setup-password",
  "/session-expired",
  "/account-locked",
  "/access-denied",
  "/maintenance",
  "/offline",
];

/** True if `pathname` is a public (session-not-required) route. */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** True if the string contains any ASCII control char (< 0x20), incl. CR/LF. */
function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) < 0x20) return true;
  }
  return false;
}

/**
 * Validate a post-login redirect target. Returns the value only if it is a safe
 * INTERNAL path; otherwise null. Blocks open-redirects (absolute URLs,
 * protocol-relative `//host`, backslash tricks, control chars) and paths that
 * would bounce straight back to a public route.
 */
export function sanitizeReturnTo(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/")) return null; // must be an internal absolute path
  if (value.startsWith("//") || value.startsWith("/\\")) return null; // protocol-relative
  if (value.includes("\\")) return null; // some browsers treat \ as /
  if (hasControlChars(value)) return null; // CRLF / control-char injection
  if (isPublicPath(value)) return null; // don't send an authed user back to /login etc.
  return value;
}
