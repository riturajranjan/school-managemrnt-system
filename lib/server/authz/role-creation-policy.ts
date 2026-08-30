// Hierarchical account provisioning — role-creation policy (Phase 9W.2,
// finalized in the User Account Creation Foundation review).
//
// ONE central, server-only map deciding which real system Role keys an actor
// holding a given real system Role key may provision an account for. Never
// trust a target role sent from the browser — every provisioning call re-checks
// against this map using the actor's REAL, server-resolved active role.
//
// This is the FINAL approved creation matrix. Same-level and upward creation
// is never allowed unless explicitly listed here — do not infer extra
// permissions by "obvious" hierarchy reasoning. Reviewed and confirmed row by
// row against the approved business rule (each row lists ONLY what that role
// may create, never more):
//   SUPER_ADMIN     → SCHOOL_ADMIN only (a PlatformAdmin boundary, see below —
//                      not modeled in this map at all)
//   SCHOOL_ADMIN    → Principal, Vice Principal, Teacher, Student, Guardian,
//                      HR Manager, Transport Manager, Transport Staff (STAFF),
//                      Librarian
//   PRINCIPAL       → Vice Principal, Teacher, Student, Guardian
//   VICE_PRINCIPAL  → Teacher, Student, Guardian
//   TEACHER         → Student, Guardian (ONLY — never another Teacher, never
//                      upward)
//   HR_ADMIN        → STAFF only (a bare operational login for an already-
//                      real, unlinked Staff record HR policy permits — HR
//                      Manager must NEVER create Platform Super Admin/School
//                      Administrator/Principal; audited before this change,
//                      current [STAFF]-only scope already satisfies that and
//                      is intentionally NOT broadened)
//   TRANSPORT_MANAGER → STAFF only, further restricted to real transport-scope
//                      staff in lib/server/users/provisioning.ts
//                      (provisionStaffLinked) — this IS "Transport Staff";
//                      there is no separate TRANSPORT_STAFF role key
//   LIBRARIAN, STAFF, STUDENT (generic), GUARDIAN → cannot create any account
//                      via this map. STUDENT's own narrow "Add/Invite My
//                      Guardian" flow (lib/server/students/self-guardian.ts)
//                      is a DELIBERATELY SEPARATE code path, never routed
//                      through this policy or the generic provisioning
//                      surface — it never appears in a role dropdown and
//                      never accepts an arbitrary target role or student id.
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
  SCHOOL_ADMIN: ["PRINCIPAL", "VICE_PRINCIPAL", "TEACHER", "HR_ADMIN", "TRANSPORT_MANAGER", "LIBRARIAN", "STAFF", "STUDENT", "GUARDIAN"],
  PRINCIPAL: ["VICE_PRINCIPAL", "TEACHER", "STUDENT", "GUARDIAN"],
  VICE_PRINCIPAL: ["TEACHER", "STUDENT", "GUARDIAN"],
  TEACHER: ["STUDENT", "GUARDIAN"],
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
