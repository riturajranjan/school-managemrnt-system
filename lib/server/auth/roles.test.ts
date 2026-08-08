import { describe, expect, it } from "vitest";
import { dashboardForRole, uiRoleFor, PLATFORM_DASHBOARD, TENANT_HOME } from "./roles";

describe("dashboardForRole", () => {
  it("maps known roles to their real routes", () => {
    expect(dashboardForRole("TEACHER")).toBe("/teacher/my-day");
    expect(dashboardForRole("ACCOUNTANT")).toBe("/fees");
    expect(dashboardForRole("LIBRARIAN")).toBe("/library");
    expect(dashboardForRole("SCHOOL_ADMIN")).toBe("/");
  });

  it("falls back to the tenant home for unknown/absent roles", () => {
    expect(dashboardForRole("SOMETHING_NEW")).toBe(TENANT_HOME);
    expect(dashboardForRole(null)).toBe(TENANT_HOME);
    expect(dashboardForRole(undefined)).toBe(TENANT_HOME);
  });
});

describe("uiRoleFor", () => {
  it("maps platform staff to super-admin regardless of role key", () => {
    expect(uiRoleFor(null, true)).toBe("super-admin");
    expect(uiRoleFor("TEACHER", true)).toBe("super-admin");
  });

  it("maps tenant roles to their UI role", () => {
    expect(uiRoleFor("TEACHER", false)).toBe("teacher");
    expect(uiRoleFor("PRINCIPAL", false)).toBe("principal");
    expect(uiRoleFor("AUDITOR", false)).toBe("auditor");
  });

  it("defaults unknown roles to administrator", () => {
    expect(uiRoleFor("WHAT", false)).toBe("administrator");
    expect(uiRoleFor(null, false)).toBe("administrator");
  });
});

describe("platform boundary", () => {
  it("platform dashboard is separate from the tenant home", () => {
    expect(PLATFORM_DASHBOARD).toBe("/super-admin");
    expect(PLATFORM_DASHBOARD).not.toBe(TENANT_HOME);
  });
});
