// Hierarchical account provisioning — role-creation policy (Phase 9W.2).
//
// ONE central, server-only map deciding which real system Role keys an actor
// holding a given real system Role key may provision an account for. Never
// trust a target role sent from the browser — every provisioning call re-checks
// against this map using the actor's REAL, server-resolved active role.
//
// Two pseudo-targets, "STUDENT" and "GUARDIAN", are real Role catalog entries
// too (see lib/server/authz/catalog.ts ROLE_PERMISSIONS) — they're just
// deliberately empty-permission roles used only to mark login-account
// identity, not administrative capability.
//
// SUPER_ADMIN is a PlatformAdmin, a separate authorization boundary from these
// tenant Roles (see lib/server/api/guard.ts requirePlatformAdmin) — its
// creation of SCHOOL_ADMIN is not modeled here; it goes through the existing
// school-provisioning flow (lib/server/platform/schools-service.ts), which
// already creates the School's first SCHOOL_ADMIN under platform authority.

export const ROLE_CREATION_POLICY: Record<string, readonly string[]> = {
  SCHOOL_ADMIN: ["PRINCIPAL", "HR_ADMIN", "TRANSPORT_MANAGER", "LIBRARIAN", "STUDENT", "GUARDIAN"],
  PRINCIPAL: ["VICE_PRINCIPAL", "TEACHER", "STUDENT", "GUARDIAN"],
  VICE_PRINCIPAL: ["TEACHER", "STUDENT"],
  HR_ADMIN: ["STAFF"],
  TRANSPORT_MANAGER: ["STAFF"],
};

/** Real system Role keys that link to a Staff record (staffId required). */
export const STAFF_LINKED_ROLE_KEYS = ["PRINCIPAL", "VICE_PRINCIPAL", "TEACHER", "HR_ADMIN", "TRANSPORT_MANAGER", "LIBRARIAN", "STAFF"] as const;

/** The two identity-foundation-only roles that link to a domain record other than Staff. */
export const STUDENT_ROLE_KEY = "STUDENT";
export const GUARDIAN_ROLE_KEY = "GUARDIAN";

/** Roles an actor holding `actorRoleKey` is authorized to provision. Empty if none. */
export function provisionableRoleKeysFor(actorRoleKey: string | null): readonly string[] {
  if (!actorRoleKey) return [];
  return ROLE_CREATION_POLICY[actorRoleKey] ?? [];
}

/** Server-side legality check — never trust a target role key from the client. */
export function canProvisionRole(actorRoleKey: string | null, targetRoleKey: string): boolean {
  return provisionableRoleKeysFor(actorRoleKey).includes(targetRoleKey);
}
