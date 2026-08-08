// ---------------------------------------------------------------------------
// Open-redirect protection for post-login `next` / `callbackUrl` params. Only
// same-origin, absolute-path targets are honoured; anything else falls back to
// the caller-supplied default. Plain module so it is unit-testable.
//
// Rejected: external URLs, protocol-relative ("//evil.com"), backslash tricks
// ("/\evil.com"), and non-path values. Public auth routes are also rejected so
// a stale `next=/login` can't create a loop.
// ---------------------------------------------------------------------------

const PUBLIC_PREFIXES = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/verify",
  "/activate-account",
  "/accept-invite",
  "/setup-password",
  "/first-login",
  "/account-locked",
  "/session-expired",
  "/access-denied",
  "/maintenance",
  "/offline",
  "/select-",
];

export function safeNext(next: string | null | undefined, fallback: string): string {
  if (!next) return fallback;
  // Must be a root-relative path.
  if (!next.startsWith("/")) return fallback;
  // Reject protocol-relative and backslash-escaped targets.
  if (next.startsWith("//") || next.startsWith("/\\") || next.includes("\\")) return fallback;
  // Reject anything that smuggles a scheme or host.
  try {
    const url = new URL(next, "http://internal.local");
    if (url.origin !== "http://internal.local") return fallback;
    const path = url.pathname;
    // Don't bounce back into a public/auth route.
    if (PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p))) return fallback;
    return path + url.search;
  } catch {
    return fallback;
  }
}
