// Next.js 16 Proxy (formerly middleware) — OPTIMISTIC auth gate.
//
// Per the Next.js auth guidance, Proxy only performs a cheap cookie-presence
// check (it runs on every request incl. prefetches, so it must not hit the DB).
// The AUTHORITATIVE session validation happens server-side in the Data Access
// Layer (lib/server/auth/dal.ts), enforced by the root layout and /super-admin
// layout. Proxy's job here:
//   1. redirect protected requests that have no session cookie straight to
//      /login (prevents any authenticated-content flash), and
//   2. forward the pathname to server components via `x-pathname` so the root
//      layout knows whether the route is public.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/server/auth/config";
import { isPublicPath } from "@/lib/server/auth/routes";

export const config = {
  // Run on everything except Next internals and static asset files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  const pass = () => NextResponse.next({ request: { headers: requestHeaders } });

  if (isPublicPath(pathname)) return pass();

  // Protected route with no session cookie → send to login (no DB read here).
  if (!request.cookies.has(SESSION_COOKIE_NAME)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search =
      pathname && pathname !== "/" ? `?returnTo=${encodeURIComponent(pathname)}` : "";
    return NextResponse.redirect(url);
  }

  return pass();
}
