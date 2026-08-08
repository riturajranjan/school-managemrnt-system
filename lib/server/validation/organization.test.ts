import { describe, expect, it } from "vitest";
import { createAcademicSessionInput, createBranchInput, createSchoolInput } from "./organization";

describe("createSchoolInput", () => {
  it("accepts valid input", () => {
    const r = createSchoolInput.safeParse({ name: "Novyra Public School", code: "NVX-001", board: "CBSE" });
    expect(r.success).toBe(true);
  });

  it("rejects an empty name and a bad code", () => {
    expect(createSchoolInput.safeParse({ name: "", code: "NVX-001" }).success).toBe(false);
    expect(createSchoolInput.safeParse({ name: "X", code: "bad code!" }).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(createSchoolInput.safeParse({ name: "X", code: "X1", email: "nope" }).success).toBe(false);
  });
});

describe("createBranchInput", () => {
  it("requires name and code", () => {
    expect(createBranchInput.safeParse({ name: "Main", code: "MAIN" }).success).toBe(true);
    expect(createBranchInput.safeParse({ code: "MAIN" }).success).toBe(false);
  });
});

describe("createAcademicSessionInput", () => {
  it("requires endDate after startDate", () => {
    const ok = createAcademicSessionInput.safeParse({ name: "2026 – 2027", code: "2026-27", startDate: "2026-04-01", endDate: "2027-03-31" });
    expect(ok.success).toBe(true);
    const bad = createAcademicSessionInput.safeParse({ name: "x", code: "2026-27", startDate: "2027-03-31", endDate: "2026-04-01" });
    expect(bad.success).toBe(false);
  });

  it("rejects malformed dates", () => {
    expect(createAcademicSessionInput.safeParse({ name: "x", code: "s1", startDate: "01-04-2026", endDate: "2027-03-31" }).success).toBe(false);
  });
});
