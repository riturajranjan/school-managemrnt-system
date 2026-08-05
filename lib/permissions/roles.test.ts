import { describe, expect, it } from "vitest";
import { hasAnyPermission, hasPermission } from "./roles";

describe("hasPermission", () => {
  it("lets a super-admin approve admissions", () => {
    expect(hasPermission("super-admin", "admissions.approve")).toBe(true);
  });

  it("lets an admission officer create and edit admissions but not approve them", () => {
    expect(hasPermission("admission-officer", "admissions.create")).toBe(true);
    expect(hasPermission("admission-officer", "admissions.edit")).toBe(true);
    expect(hasPermission("admission-officer", "admissions.approve")).toBe(false);
  });

  it("keeps teachers from editing sensitive admission or finance data", () => {
    expect(hasPermission("teacher", "students.view")).toBe(true);
    expect(hasPermission("teacher", "admissions.edit")).toBe(false);
    expect(hasPermission("teacher", "fees.record")).toBe(false);
    expect(hasPermission("teacher", "students.edit")).toBe(false);
  });

  it("lets an accountant view fee-related student information without editing student profiles", () => {
    expect(hasPermission("accountant", "fees.view")).toBe(true);
    expect(hasPermission("accountant", "fees.record")).toBe(true);
    expect(hasPermission("accountant", "students.edit")).toBe(false);
  });

  it("restricts a parent to viewing their own linked children's data", () => {
    expect(hasPermission("parent", "students.view")).toBe(true);
    expect(hasPermission("parent", "students.edit")).toBe(false);
    expect(hasPermission("parent", "admissions.view")).toBe(false);
  });

  it("restricts a student role to view-only access", () => {
    expect(hasPermission("student", "students.view")).toBe(true);
    expect(hasPermission("student", "students.edit")).toBe(false);
    expect(hasPermission("student", "fees.view")).toBe(false);
  });
});

describe("hasAnyPermission", () => {
  it("returns true if the role has at least one of the listed permissions", () => {
    expect(hasAnyPermission("teacher", ["admissions.approve", "students.view"])).toBe(true);
  });

  it("returns false if the role has none of the listed permissions", () => {
    expect(hasAnyPermission("student", ["admissions.approve", "fees.record"])).toBe(false);
  });
});
