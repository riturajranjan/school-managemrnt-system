import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/context";
import { resolveOnboarding, type ActiveSelection } from "./onboarding";
import { resolveSimplePostLoginDestination } from "./credentials";
import { uiRoleFor } from "./roles";

// ---------------------------------------------------------------------------
// Server-side access gate, run once per document load from the root layout.
// It is the pre-render authority for authenticated routes: it resolves the real
// session, enforces onboarding/setup routing, and hands the shell a SAFE view
// of the current identity. Anonymous bouncing for protected routes is done
// earlier (per request) by the proxy; per-action authorization is done by the
// service guards. This gate ties them together for the UI without a flash.
// ---------------------------------------------------------------------------

// Viewable with NO session (mirrors the proxy public list).
const ALWAYS_ALLOW = [
  "/login", "/forgot-password", "/reset-password", "/verify", "/verify-email", "/verify-otp",
  "/activate-account", "/accept-invite", "/account-locked", "/session-expired",
  "/access-denied", "/maintenance", "/offline",
];

// Session required, but EXEMPT from the "onboarding complete" requirement —
// these are the setup steps themselves.
const SETUP_ROUTES = [
  "/setup-password", "/first-login",
  "/select-school", "/select-role", "/select-branch", "/select-session", "/select-child",
];

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export type GateIdentity = {
  user: { id: string; name: string; email: string };
  uiRole: string;
  platformRole: string | null;
  selection: ActiveSelection | null;
};

export type GateResult = { authed: false } | ({ authed: true } & GateIdentity);

async function pathname(): Promise<string> {
  const h = await headers();
  return h.get("x-pathname") ?? "/";
}

export async function resolveGate(): Promise<GateResult> {
  // Enforcement can be disabled for local pre-database UI review only.
  if (process.env.AUTH_ENFORCED === "false") return { authed: false };

  const path = await pathname();
  const user = await getCurrentUser();

  // Public pages render without a session. An already-authenticated user who
  // lands on /login is sent onward to their resolved destination (Step 14).
  if (matches(path, ALWAYS_ALLOW)) {
    if (user && (path === "/login" || path.startsWith("/login/"))) {
      redirect(await resolveSimplePostLoginDestination(user.id));
    }
    return { authed: false };
  }

  // Everything below requires a session.
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }

  const resolution = await resolveOnboarding(user!.id);
  const identity: GateIdentity = {
    user: user!,
    uiRole: uiRoleFor(resolution.done ? resolution.selection.roleKey : null, resolution.done && resolution.platformRole != null),
    platformRole: resolution.done ? resolution.platformRole : null,
    selection: resolution.done ? resolution.selection : null,
  };

  if (matches(path, SETUP_ROUTES)) {
    // On a setup page: if setup is finished, go to the dashboard; if the user is
    // on the WRONG step, correct them; otherwise render this (correct) step.
    if (resolution.done) redirect(resolution.route);
    if (resolution.route !== path && !path.startsWith(resolution.route + "/")) redirect(resolution.route);
    return { authed: true, ...identity };
  }

  // Protected application route: setup must be complete.
  if (!resolution.done) redirect(resolution.route);

  return { authed: true, ...identity };
}
