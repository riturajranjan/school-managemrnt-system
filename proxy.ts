import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// ---------------------------------------------------------------------------
// Route protection (Next.js 16 Proxy — the renamed `middleware` convention).
// This is an OPTIMISTIC gate: it only checks for the presence of a valid
// session cookie — it does NOT trust it for authorization. Real permission/
// tenant checks always happen server-side via resolveContext() and the
// requirePermission() guards. The proxy exists so anonymous users are bounced
// before rendering, not as the security boundary itself.
//
// Enforcement is ON by default and can be disabled for local pre-database UI
// review with AUTH_ENFORCED=false (see .env / .env.example). Never set that in a
// hosted environment.
// ---------------------------------------------------------------------------

// Truly public — viewable with NO session. Setup/selector routes are NOT here:
// they require a session and are enforced (plus onboarding routing) by the
// server-side gate in the root layout (see lib/server/auth/gate.ts).
const PUBLIC_PREFIXES = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/verify",
  "/verify-otp",
  "/verify-email",
  "/activate-account",
  "/accept-invite",
  "/account-locked",
  "/session-expired",
  "/access-denied",
  "/maintenance",
  "/offline",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

// Forwards the request path to server components (root-layout gate) via a
// header, since layouts don't otherwise receive the pathname.
function withPathname(request: NextRequest): NextResponse {
  const headers = new Headers(request.headers);
  headers.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers } });
}

export function proxy(request: NextRequest) {
  if (process.env.AUTH_ENFORCED === "false") return withPathname(request);

  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return withPathname(request);

  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return withPathname(request);
}

export const config = {
  // Protect everything except Next internals, the auth API, and static assets.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)"],
};
