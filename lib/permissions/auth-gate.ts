// Explicit three-state contract for a client-side identity/permission gate —
// e.g. app/super-admin/layout.tsx, which is platform-admin-only. Pure (no
// React, no DB) so the states are unit-testable in isolation.
//
// The bug this exists to prevent: PermissionsProvider's capabilities are
// unauthenticated/default (role="teacher", isPlatformAdmin=false) until the
// real server-resolved data arrives — that "not yet resolved" moment must
// never be treated the same as "resolved, and this account genuinely lacks
// the permission." Collapsing those two into one boolean is exactly what
// made a real Platform Super Admin briefly render as "Permission required...
// Your role (Teacher)" during the loading window.
export type AuthGateState = "LOADING" | "DENIED" | "ALLOWED";

export function resolvePlatformAdminGate(params: {
  capabilitiesLoading: boolean;
  isPlatformAdmin: boolean;
}): AuthGateState {
  if (params.capabilitiesLoading) return "LOADING";
  return params.isPlatformAdmin ? "ALLOWED" : "DENIED";
}
