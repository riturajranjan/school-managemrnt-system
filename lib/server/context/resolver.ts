// Centralized post-login resolver (Batch 4). ONE place that decides where an
// authenticated user goes next, auto-selecting context where the choice is
// unambiguous and routing to the matching selector otherwise. Nothing else
// should scatter this logic.
import { prisma } from "@/lib/db/prisma";
import {
  getAccessibleBranches,
  getAcademicSessions,
  getAccessibleSchools,
  getAssignedRoles,
  setAcademicSession,
  setBranch,
  setRole,
  setSchool,
} from "./service";

/** Role key → existing dashboard route (item 14). "/dashboard" maps to "/". */
export function landingForRoleKey(key: string | undefined): string {
  switch (key) {
    case "SCHOOL_ADMIN":
    case "PRINCIPAL":
    case "VICE_PRINCIPAL":
      return "/";
    case "TEACHER":
      return "/teacher/my-day";
    case "LIBRARIAN":
      return "/library";
    case "TRANSPORT_MANAGER":
      return "/transport";
    case "HR_ADMIN":
      return "/hr";
    // Phase 9W.2 — generic Staff self-service account: lands on the one real
    // page it can use (dashboard.view + hr.viewOwn only).
    case "STAFF":
      return "/hr/employee-self-service";
    // Phase 9W.2 — account-foundation-only roles: no real portal exists yet,
    // so they land on an honest minimal identity page, never the staff-
    // oriented main dashboard (which assumes a Staff profile).
    case "STUDENT":
      return "/student";
    case "GUARDIAN":
      return "/parent";
    default:
      return "/";
  }
}

/**
 * Resolve the next destination for a just-authenticated user. Persists any
 * auto-selected context server-side. Returns an internal path.
 */
export async function resolvePostLogin(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      passwordSetupRequired: true,
      platformAdmin: { select: { id: true } },
      memberships: { where: { status: "ACTIVE" }, select: { id: true } },
    },
  });
  if (!user) return "/login";
  // Reaching resolvePostLogin at all means a real password was already
  // verified (login requires passwordHash to be set) — so passwordSetupRequired
  // here can only mean "an administrator set this password directly and asked
  // to force a change", never the ordinary invite-link-pending state (that
  // account has no password yet and can never reach login to begin with).
  if (user.passwordSetupRequired) return "/change-password";
  if (user.platformAdmin) return "/super-admin/dashboard";
  if (user.memberships.length === 0) return "/access-denied";

  const stored = await prisma.userActiveContext.findUnique({ where: { userId } });
  let schoolId = stored?.schoolId ?? null;
  let roleId = stored?.roleId ?? null;
  let branchId = stored?.branchId ?? null;
  let academicSessionId = stored?.academicSessionId ?? null;

  // School — auto-select when there's exactly one.
  if (!schoolId) {
    const schools = await getAccessibleSchools(userId);
    if (schools.length === 0) return "/access-denied";
    if (schools.length > 1) return "/select-school";
    await setSchool(userId, schools[0].id);
    schoolId = schools[0].id;
    branchId = null; // setSchool clears these
    academicSessionId = null;
  }

  // Role — auto-select when there's exactly one.
  if (!roleId) {
    const roles = await getAssignedRoles(userId);
    if (roles.length === 0) return "/access-denied";
    if (roles.length > 1) return "/select-role";
    await setRole(userId, roles[0].id);
    roleId = roles[0].id;
  }

  // Branch — auto-select when there's exactly one; skip if the school has none.
  if (!branchId) {
    const branches = await getAccessibleBranches(userId, schoolId);
    if (branches.length > 1) return "/select-branch";
    if (branches.length === 1) {
      await setBranch(userId, branches[0].id);
      branchId = branches[0].id;
    }
  }

  // Academic session — prefer the single current one; else the only one; else select.
  if (!academicSessionId) {
    const sessions = await getAcademicSessions(userId, schoolId);
    const current = sessions.filter((s) => s.isCurrent);
    if (current.length === 1) {
      await setAcademicSession(userId, current[0].id);
    } else if (sessions.length === 1) {
      await setAcademicSession(userId, sessions[0].id);
    } else if (sessions.length > 1) {
      return "/select-session";
    }
  }

  const roles = await getAssignedRoles(userId);
  const activeRole = roles.find((r) => r.id === roleId) ?? roles[0];
  return landingForRoleKey(activeRole?.key);
}
