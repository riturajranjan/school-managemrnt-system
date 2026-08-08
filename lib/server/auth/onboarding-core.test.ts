import { describe, expect, it } from "vitest";
import { decideOnboarding, type ContextChoices, type OnboardingUserState, type StoredContextState } from "./onboarding-core";

const activeUser: OnboardingUserState = { status: "ACTIVE", passwordSetupRequired: false, profileCompletedAt: new Date() };

function choices(over: Partial<ContextChoices> = {}): ContextChoices {
  return {
    tenantId: "t1",
    schools: [{ id: "s1", name: "School One", code: "S1" }],
    roles: [{ roleId: "r1", roleKey: "TEACHER", roleName: "Teacher" }],
    branches: [{ id: "b1", name: "Main", code: "MAIN", schoolId: "s1" }],
    branchBound: false,
    ...over,
  };
}

const noStore: StoredContextState = null;

describe("decideOnboarding — account status gates", () => {
  it("suspended → account-locked", () => {
    const d = decideOnboarding({ ...activeUser, status: "SUSPENDED" }, null, choices(), noStore);
    expect(d).toMatchObject({ done: false, route: "/account-locked" });
  });
  it("deactivated → account-locked", () => {
    const d = decideOnboarding({ ...activeUser, status: "DEACTIVATED" }, null, choices(), noStore);
    expect(d).toMatchObject({ done: false, route: "/account-locked" });
  });
  it("invited → setup-password", () => {
    const d = decideOnboarding({ ...activeUser, status: "INVITED" }, null, choices(), noStore);
    expect(d).toMatchObject({ done: false, route: "/setup-password" });
  });
  it("passwordSetupRequired → setup-password", () => {
    const d = decideOnboarding({ ...activeUser, passwordSetupRequired: true }, null, choices(), noStore);
    expect(d).toMatchObject({ done: false, route: "/setup-password" });
  });
});

describe("decideOnboarding — platform boundary", () => {
  it("platform admin goes straight to the platform dashboard, ignoring tenant choices", () => {
    const d = decideOnboarding(activeUser, "SUPER_ADMIN", null, noStore);
    expect(d).toMatchObject({ done: true, kind: "platform", route: "/super-admin", platformRole: "SUPER_ADMIN" });
  });
  it("platform status is checked before tenant membership (no membership needed)", () => {
    const d = decideOnboarding({ ...activeUser, profileCompletedAt: null }, "SUPER_ADMIN", null, noStore);
    expect(d).toMatchObject({ done: true, kind: "platform" });
  });
});

describe("decideOnboarding — membership & profile", () => {
  it("no membership → access-denied", () => {
    expect(decideOnboarding(activeUser, null, null, noStore)).toMatchObject({ done: false, route: "/access-denied" });
    expect(decideOnboarding(activeUser, null, choices({ schools: [] }), noStore)).toMatchObject({ done: false, route: "/access-denied" });
    expect(decideOnboarding(activeUser, null, choices({ roles: [] }), noStore)).toMatchObject({ done: false, route: "/access-denied" });
  });
  it("incomplete profile → first-login", () => {
    const d = decideOnboarding({ ...activeUser, profileCompletedAt: null }, null, choices(), noStore);
    expect(d).toMatchObject({ done: false, route: "/first-login" });
  });
});

describe("decideOnboarding — single school/role auto-resolves to the dashboard", () => {
  it("teacher with one school/branch → teacher dashboard, branch auto-selected when branch-bound", () => {
    const d = decideOnboarding(activeUser, null, choices({ branchBound: true }), noStore);
    expect(d).toMatchObject({ done: true, kind: "tenant", route: "/teacher/my-day", schoolId: "s1", branchId: "b1" });
  });
  it("school-scoped role leaves branch null", () => {
    const d = decideOnboarding(activeUser, null, choices({ branchBound: false }), noStore);
    expect(d).toMatchObject({ done: true, branchId: null });
  });
});

describe("decideOnboarding — multi-school / multi-role selection", () => {
  const multiSchool = choices({ schools: [{ id: "s1", name: "One", code: "S1" }, { id: "s2", name: "Two", code: "S2" }] });
  const multiRole = choices({ roles: [{ roleId: "r1", roleKey: "TEACHER", roleName: "Teacher" }, { roleId: "r2", roleKey: "PRINCIPAL", roleName: "Principal" }] });

  it("multiple schools with no stored choice → select-school", () => {
    expect(decideOnboarding(activeUser, null, multiSchool, noStore)).toMatchObject({ done: false, route: "/select-school" });
  });
  it("multiple schools honour a valid stored choice", () => {
    const d = decideOnboarding(activeUser, null, multiSchool, { schoolId: "s2", branchId: null, activeRoleId: null });
    expect(d).toMatchObject({ done: true, schoolId: "s2" });
  });
  it("a stored school that is no longer accessible is ignored → select-school", () => {
    const d = decideOnboarding(activeUser, null, multiSchool, { schoolId: "s-stale", branchId: null, activeRoleId: null });
    expect(d).toMatchObject({ done: false, route: "/select-school" });
  });
  it("multiple roles with no stored choice → select-role", () => {
    expect(decideOnboarding(activeUser, null, multiRole, noStore)).toMatchObject({ done: false, route: "/select-role" });
  });
  it("multiple roles honour a valid stored role", () => {
    const d = decideOnboarding(activeUser, null, multiRole, { schoolId: null, branchId: null, activeRoleId: "r2" });
    expect(d).toMatchObject({ done: true, route: "/", role: { roleKey: "PRINCIPAL" } });
  });
  it("an arbitrary/stale stored role is rejected → select-role (client can't force a role)", () => {
    const d = decideOnboarding(activeUser, null, multiRole, { schoolId: null, branchId: null, activeRoleId: "r-injected" });
    expect(d).toMatchObject({ done: false, route: "/select-role" });
  });
});

describe("decideOnboarding — branch selection", () => {
  const twoBranches = choices({
    branchBound: true,
    branches: [
      { id: "b1", name: "Main", code: "MAIN", schoolId: "s1" },
      { id: "b2", name: "North", code: "NORTH", schoolId: "s1" },
    ],
  });
  it("branch-bound role with multiple branches and no stored choice → select-branch", () => {
    expect(decideOnboarding(activeUser, null, twoBranches, noStore)).toMatchObject({ done: false, route: "/select-branch" });
  });
  it("branch-bound role honours a valid stored branch", () => {
    const d = decideOnboarding(activeUser, null, twoBranches, { schoolId: null, branchId: "b2", activeRoleId: null });
    expect(d).toMatchObject({ done: true, branchId: "b2" });
  });
});
