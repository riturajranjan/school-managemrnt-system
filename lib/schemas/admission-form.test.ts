import { describe, expect, it } from "vitest";
import { admissionFormSchema, guardiansStepSchema, studentDetailsSchema } from "./admission-form";

const validGuardian = {
  id: "g1",
  role: "father" as const,
  firstName: "Rohit",
  lastName: "Sharma",
  phone: "+91 98765 43210",
  isPrimary: true,
  isEmergencyContact: true,
  authorizedPickup: true,
  communicationPreference: "whatsapp" as const,
};

describe("studentDetailsSchema", () => {
  it("rejects missing required fields", () => {
    const result = studentDetailsSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts a fully valid student details payload", () => {
    const result = studentDetailsSchema.safeParse({
      firstName: "Aarav",
      lastName: "Sharma",
      dob: "2016-04-12",
      gender: "male",
      nationality: "Indian",
      appliedClassId: "class-5",
      admissionType: "new",
      session: "2026-2027",
    });
    expect(result.success).toBe(true);
  });
});

describe("guardiansStepSchema", () => {
  it("requires at least one guardian", () => {
    const result = guardiansStepSchema.safeParse({ guardians: [] });
    expect(result.success).toBe(false);
  });

  it("requires one guardian to be marked primary", () => {
    const result = guardiansStepSchema.safeParse({ guardians: [{ ...validGuardian, isPrimary: false }] });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/primary/i);
    }
  });

  it("accepts a guardian list with exactly one primary", () => {
    const result = guardiansStepSchema.safeParse({ guardians: [validGuardian] });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid phone number", () => {
    const result = guardiansStepSchema.safeParse({ guardians: [{ ...validGuardian, phone: "abc" }] });
    expect(result.success).toBe(false);
  });
});

describe("admissionFormSchema", () => {
  it("rejects an empty payload", () => {
    const result = admissionFormSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
