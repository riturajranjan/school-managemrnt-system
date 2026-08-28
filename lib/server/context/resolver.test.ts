// Pure role→route routing table (no DB). See resolver.db.test.ts for the
// full resolvePostLogin flow against real data.
import { describe, expect, it } from "vitest";
import { landingForRoleKey } from "@/lib/server/context/resolver";

describe("landingForRoleKey", () => {
  it("routes senior-admin roles to the main dashboard", () => {
    expect(landingForRoleKey("SCHOOL_ADMIN")).toBe("/");
    expect(landingForRoleKey("PRINCIPAL")).toBe("/");
    expect(landingForRoleKey("VICE_PRINCIPAL")).toBe("/");
  });

  it("routes TEACHER to My Day, never the main/admin dashboard", () => {
    expect(landingForRoleKey("TEACHER")).toBe("/teacher/my-day");
  });

  it("routes module-manager roles to their own module home", () => {
    expect(landingForRoleKey("LIBRARIAN")).toBe("/library");
    expect(landingForRoleKey("TRANSPORT_MANAGER")).toBe("/transport");
    expect(landingForRoleKey("HR_ADMIN")).toBe("/hr");
  });

  it("routes generic Staff to employee self-service, not the staff-oriented main dashboard", () => {
    expect(landingForRoleKey("STAFF")).toBe("/hr/employee-self-service");
  });

  it("routes STUDENT and GUARDIAN to their own honest foundation pages", () => {
    expect(landingForRoleKey("STUDENT")).toBe("/student");
    expect(landingForRoleKey("GUARDIAN")).toBe("/parent");
  });

  it("falls back to / for an unknown or missing role key", () => {
    expect(landingForRoleKey(undefined)).toBe("/");
    expect(landingForRoleKey("NOT_A_REAL_ROLE")).toBe("/");
  });
});
