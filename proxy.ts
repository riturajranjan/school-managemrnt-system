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

const PUBLIC_PREFIXES = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/verify",
  "/verify-otp",
  "/verify-email",
  "/activate-account",
  "/accept-invite",
  "/setup-password",
  "/first-login",
  "/account-locked",
  "/session-expired",
  "/access-denied",
  "/maintenance",
  "/offline",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export function proxy(request: NextRequest) {
  if (process.env.AUTH_ENFORCED === "false") return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Protect everything except Next internals, the auth API, and static assets.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)"],
};
