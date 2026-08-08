// ---------------------------------------------------------------------------
// PURE onboarding routing core — no I/O, no Prisma, no server-only. All the
// pre-dashboard decision logic lives here so it can be unit-tested in isolation
// (see onboarding-core.test.ts). The DB-backed loader in onboarding.ts feeds it
// already-validated data and applies the result.
// ---------------------------------------------------------------------------

import { dashboardForRole, PLATFORM_DASHBOARD } from "./roles";

// Setup / selector routes (must match the (auth) pages and the gate).
export const ROUTE = {
  accountLocked: "/account-locked",
  setupPassword: "/setup-password",
  firstLogin: "/first-login",
  selectSchool: "/select-school",
  selectRole: "/select-role",
  selectBranch: "/select-branch",
  accessDenied: "/access-denied",
} as const;

export type SchoolChoice = { id: string; name: string; code: string };
export type RoleChoice = { roleId: string; roleKey: string; roleName: string };
export type BranchChoice = { id: string; name: string; code: string; schoolId: string };

export type ContextChoices = {
  tenantId: string;
  schools: SchoolChoice[];
  roles: RoleChoice[];
  branches: BranchChoice[];
  branchBound: boolean;
};

export type ActiveSelection = {
  tenantId: string;
  schoolId: string | null;
  branchId: string | null;
  academicSessionId: string | null;
  roleKey: string;
  roleId: string;
};

export type OnboardingUserState = {
  status: string;
  passwordSetupRequired: boolean;
  profileCompletedAt: Date | null;
};

export type StoredContextState = { schoolId: string | null; branchId: string | null; activeRoleId: string | null } | null;

export type OnboardingDecision =
  | { done: false; route: string; reason: string }
  | { done: true; kind: "platform"; route: string; platformRole: string }
  | { done: true; kind: "tenant"; route: string; schoolId: string; branchId: string | null; role: RoleChoice };

// Given fully-loaded (already server-validated) state, decide the next step.
// Order matters: account status → password → platform → membership → profile →
// school → role → branch. Everything is derived from real data; the stored
// context only short-circuits a selector when it still matches a real choice.
export function decideOnboarding(
  user: OnboardingUserState,
  platformRole: string | null,
  choices: ContextChoices | null,
  stored: StoredContextState,
): OnboardingDecision {
  if (user.status === "SUSPENDED" || user.status === "DEACTIVATED") {
    return { done: false, route: ROUTE.accountLocked, reason: "status-" + user.status.toLowerCase() };
  }
  if (user.passwordSetupRequired || user.status === "INVITED") {
    return { done: false, route: ROUTE.setupPassword, reason: "password-setup" };
  }
  // Platform staff bypass tenant onboarding entirely (Super Admin isolation).
  if (platformRole) {
    return { done: true, kind: "platform", route: PLATFORM_DASHBOARD, platformRole };
  }
  if (!choices || choices.schools.length === 0 || choices.roles.length === 0) {
    return { done: false, route: ROUTE.accessDenied, reason: "no-membership" };
  }
  if (!user.profileCompletedAt) {
    return { done: false, route: ROUTE.firstLogin, reason: "profile" };
  }

  // School: auto when single, else honour a still-valid stored choice, else prompt.
  let schoolId: string;
  if (choices.schools.length === 1) {
    schoolId = choices.schools[0].id;
  } else if (stored?.schoolId && choices.schools.some((s) => s.id === stored.schoolId)) {
    schoolId = stored.schoolId;
  } else {
    return { done: false, route: ROUTE.selectSchool, reason: "multi-school" };
  }

  // Role: auto when single, else honour stored, else prompt.
  let role: RoleChoice | undefined;
  if (choices.roles.length === 1) {
    role = choices.roles[0];
  } else if (stored?.activeRoleId) {
    role = choices.roles.find((r) => r.roleId === stored.activeRoleId);
  }
  if (!role) return { done: false, route: ROUTE.selectRole, reason: "multi-role" };

  // Branch: forced only for branch-bound roles with a genuine choice; otherwise
  // auto-pick the single accessible branch (school-scoped roles leave it null).
  const branchesInSchool = choices.branches.filter((b) => b.schoolId === schoolId);
  let branchId: string | null = null;
  if (choices.branchBound) {
    if (branchesInSchool.length === 1) {
      branchId = branchesInSchool[0].id;
    } else if (stored?.branchId && branchesInSchool.some((b) => b.id === stored.branchId)) {
      branchId = stored.branchId;
    } else if (branchesInSchool.length > 1) {
      return { done: false, route: ROUTE.selectBranch, reason: "multi-branch" };
    }
  } else if (stored?.branchId && branchesInSchool.some((b) => b.id === stored.branchId)) {
    branchId = stored.branchId;
  }

  return { done: true, kind: "tenant", route: dashboardForRole(role.roleKey), schoolId, branchId, role };
}
