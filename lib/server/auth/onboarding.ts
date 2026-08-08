import "server-only";
import { prisma } from "@/lib/db/prisma";
import { dashboardForRole } from "./roles";
import {
  decideOnboarding,
  ROUTE,
  type ActiveSelection,
  type BranchChoice,
  type ContextChoices,
  type RoleChoice,
  type SchoolChoice,
} from "./onboarding-core";

// ---------------------------------------------------------------------------
// Pre-dashboard resolver (DB loader around the pure onboarding core). The SINGLE
// server-side authority that decides where an authenticated user goes next: a
// restricted-state page, a setup step, a context selector, or their role
// dashboard. Business-module layouts and the login/setup pages all defer to this
// — redirect logic is never scattered.
//
// Everything is derived from REAL membership + role-assignment rows and
// re-validated on every call. The persisted UserActiveContext is a convenience
// (so returning users skip selectors) and NEVER an authorization source.
// ---------------------------------------------------------------------------

export type { ActiveSelection, ContextChoices } from "./onboarding-core";

export type OnboardingResolution =
  | { done: false; route: string; reason: string }
  | { done: true; route: string; selection: ActiveSelection; platformRole: string | null };

// Loads the membership graph for a user's FIRST active tenant and derives the
// distinct schools / roles / branches they may act within. Single-tenant is the
// current shape; if a user ever has multiple active tenants we take the first
// (tenant selection UI is a later concern — memberships are still real).
export async function deriveContextChoices(userId: string): Promise<ContextChoices | null> {
  const membership = await prisma.tenantMembership.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
    include: {
      tenant: { select: { id: true } },
      roleAssignments: {
        include: { role: { select: { id: true, key: true, name: true } } },
      },
    },
  });
  if (!membership || membership.roleAssignments.length === 0) return null;

  const tenantId = membership.tenantId;

  // Distinct roles across all assignments.
  const roleMap = new Map<string, RoleChoice>();
  let branchBound = false;
  const scopedSchoolIds = new Set<string>();
  const scopedBranchIds = new Set<string>();
  let allTenant = false;

  for (const ra of membership.roleAssignments) {
    roleMap.set(ra.role.id, { roleId: ra.role.id, roleKey: ra.role.key, roleName: ra.role.name });
    if (ra.scopeType === "ALL_TENANT") allTenant = true;
    if (ra.scopeType === "SCHOOLS" && ra.schoolId) scopedSchoolIds.add(ra.schoolId);
    if (ra.scopeType === "BRANCHES" && ra.branchId) {
      branchBound = true;
      scopedBranchIds.add(ra.branchId);
    }
  }

  // Resolve accessible schools.
  let schools: SchoolChoice[];
  if (allTenant) {
    schools = await prisma.school.findMany({
      where: { tenantId, status: { not: "ARCHIVED" } },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    });
  } else {
    // Schools referenced directly (SCHOOLS scope) plus schools owning scoped branches.
    const branchSchools = scopedBranchIds.size
      ? await prisma.branch.findMany({ where: { id: { in: [...scopedBranchIds] } }, select: { schoolId: true } })
      : [];
    const schoolIds = new Set<string>([...scopedSchoolIds, ...branchSchools.map((b) => b.schoolId)]);
    schools = schoolIds.size
      ? await prisma.school.findMany({
          where: { id: { in: [...schoolIds] }, tenantId },
          select: { id: true, name: true, code: true },
          orderBy: { name: "asc" },
        })
      : [];
  }

  // Resolve accessible branches.
  let branches: BranchChoice[];
  if (scopedBranchIds.size) {
    branches = await prisma.branch.findMany({
      where: { id: { in: [...scopedBranchIds] }, status: { not: "ARCHIVED" } },
      select: { id: true, name: true, code: true, schoolId: true },
      orderBy: { name: "asc" },
    });
  } else {
    branches = schools.length
      ? await prisma.branch.findMany({
          where: { schoolId: { in: schools.map((s) => s.id) }, status: { not: "ARCHIVED" } },
          select: { id: true, name: true, code: true, schoolId: true },
          orderBy: { name: "asc" },
        })
      : [];
  }

  return { tenantId, schools, roles: [...roleMap.values()], branches, branchBound };
}

async function readStoredContext(userId: string) {
  return prisma.userActiveContext.findUnique({ where: { userId } });
}

// Persists a resolved selection. Convenience only — validated on every request.
export async function persistActiveContext(userId: string, sel: ActiveSelection): Promise<void> {
  await prisma.userActiveContext.upsert({
    where: { userId },
    update: {
      tenantId: sel.tenantId,
      schoolId: sel.schoolId,
      branchId: sel.branchId,
      academicSessionId: sel.academicSessionId,
      activeRoleId: sel.roleId,
    },
    create: {
      userId,
      tenantId: sel.tenantId,
      schoolId: sel.schoolId,
      branchId: sel.branchId,
      academicSessionId: sel.academicSessionId,
      activeRoleId: sel.roleId,
    },
  });
}

// Patches individual fields of the stored context (used by the selector actions
// as the user makes one choice at a time). Convenience only — re-validated by
// resolveOnboarding on the very next request.
export async function patchStoredContext(
  userId: string,
  data: { tenantId?: string; schoolId?: string; branchId?: string; academicSessionId?: string; activeRoleId?: string },
): Promise<void> {
  await prisma.userActiveContext.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
}

// Picks the current academic session for a school, if any.
async function currentSessionFor(schoolId: string | null): Promise<string | null> {
  if (!schoolId) return null;
  const s = await prisma.academicSession.findFirst({
    where: { schoolId, isCurrent: true, status: "ACTIVE" },
    select: { id: true },
  });
  return s?.id ?? null;
}

// The central resolver. Loads real state, applies the pure decision, then (for a
// resolved tenant context) attaches the current academic session, persists the
// selection and stamps completion once.
export async function resolveOnboarding(userId: string): Promise<OnboardingResolution> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true, passwordSetupRequired: true, profileCompletedAt: true, onboardingCompletedAt: true },
  });
  if (!user) return { done: false, route: ROUTE.accessDenied, reason: "no-user" };

  const platformAdmin = await prisma.platformAdmin.findUnique({ where: { userId }, select: { role: true, status: true } });
  const activePlatformRole = platformAdmin && platformAdmin.status === "ACTIVE" ? platformAdmin.role : null;

  // Only load tenant choices when they might be needed (not platform-only).
  const choices = activePlatformRole ? null : await deriveContextChoices(userId);
  const stored = activePlatformRole ? null : await readStoredContext(userId);

  const decision = decideOnboarding(user, activePlatformRole, choices, stored);

  if (!decision.done) return decision;
  if (decision.kind === "platform") {
    return { done: true, route: decision.route, selection: platformSelection(), platformRole: decision.platformRole };
  }

  // Tenant context resolved — attach current session, persist, stamp once.
  const academicSessionId = await currentSessionFor(decision.schoolId);
  const selection: ActiveSelection = {
    tenantId: choices!.tenantId,
    schoolId: decision.schoolId,
    branchId: decision.branchId,
    academicSessionId,
    roleKey: decision.role.roleKey,
    roleId: decision.role.roleId,
  };
  await persistActiveContext(userId, selection);
  if (!user.onboardingCompletedAt) {
    await prisma.user.update({ where: { id: userId }, data: { onboardingCompletedAt: new Date() } });
  }
  return { done: true, route: selection.roleKey ? dashboardForRole(decision.role.roleKey) : dashboardForRole(null), selection, platformRole: null };
}

// Convenience wrapper used by the login action.
export async function resolvePostLoginDestination(userId: string): Promise<string> {
  return (await resolveOnboarding(userId)).route;
}

// Platform admins have no tenant selection; a sentinel keeps the type total.
function platformSelection(): ActiveSelection {
  return { tenantId: "", schoolId: null, branchId: null, academicSessionId: null, roleKey: "PLATFORM", roleId: "" };
}
