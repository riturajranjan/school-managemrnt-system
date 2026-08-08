// ---------------------------------------------------------------------------
// Post-login destinations, keyed by REAL server-side role identity — never a
// client-supplied role string. `ROLE_DASHBOARD` maps a tenant system-role key
// (see lib/server/rbac/catalog.ts SYSTEM_ROLES) to an existing app route;
// `PLATFORM_DASHBOARD` is the platform-admin landing. Every route here is
// verified to exist in the app router — we never invent routes.
//
// Plain module (no server-only) so it can be imported by tests.
// ---------------------------------------------------------------------------

/** Landing route for a tenant role. Falls back to the tenant home ("/"). */
export const ROLE_DASHBOARD: Record<string, string> = {
  SCHOOL_ADMIN: "/",
  PRINCIPAL: "/",
  ACADEMIC_COORDINATOR: "/academics",
  TEACHER: "/teacher/my-day",
  ACCOUNTANT: "/fees",
  HR_ADMIN: "/hr",
  LIBRARIAN: "/library",
  TRANSPORT_MANAGER: "/transport",
  RECEPTIONIST: "/front-desk",
  PARENT: "/parent/activities",
  STUDENT: "/student/activities",
  AUDITOR: "/",
};

export const TENANT_HOME = "/";

/** Platform staff (PlatformAdmin) land here regardless of tenant roles. */
export const PLATFORM_DASHBOARD = "/super-admin";

export function dashboardForRole(roleKey: string | null | undefined): string {
  if (!roleKey) return TENANT_HOME;
  return ROLE_DASHBOARD[roleKey] ?? TENANT_HOME;
}

// Maps a server role identity to the UI's UserRole union (lib/permissions/roles)
// so the client permission provider can seed the correct initial view. This
// drives UI affordances only — server guards remain the authorization boundary.
const DB_ROLE_TO_UI: Record<string, string> = {
  SCHOOL_ADMIN: "administrator",
  PRINCIPAL: "principal",
  ACADEMIC_COORDINATOR: "academic-coordinator",
  TEACHER: "teacher",
  ACCOUNTANT: "accountant",
  HR_ADMIN: "hr-manager",
  LIBRARIAN: "librarian",
  TRANSPORT_MANAGER: "transport-manager",
  RECEPTIONIST: "receptionist",
  PARENT: "parent",
  STUDENT: "student",
  AUDITOR: "auditor",
};

/** UI role for a resolved server role. Platform staff map to "super-admin". */
export function uiRoleFor(roleKey: string | null | undefined, isPlatform: boolean): string {
  if (isPlatform) return "super-admin";
  if (!roleKey) return "administrator";
  return DB_ROLE_TO_UI[roleKey] ?? "administrator";
}
