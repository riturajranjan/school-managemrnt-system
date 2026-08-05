import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { schoolClasses } from "@/lib/data/seed/reference";
import type { AdmissionApplication } from "@/lib/types/admissions";
import { convertApplicationToStudent, validateEnrollment, type EnrollmentInput } from "./enrollment-service";

function baseApplication(overrides: Partial<AdmissionApplication> = {}): AdmissionApplication {
  const schoolClass = schoolClasses[3]; // Class 1
  return {
    id: "app-test-1",
    applicationNumber: "ADM-TEST-1",
    session: "2026-2027",
    branchId: "main",
    draft: false,
    stage: "approved",
    priority: "medium",
    source: "website",
    appliedClassId: schoolClass.id,
    admissionType: "new",
    student: { firstName: "Test", lastName: "Student", dob: "2019-01-01", gender: "male", nationality: "Indian" },
    guardians: [
      {
        id: "g1",
        role: "father",
        firstName: "Test",
        lastName: "Guardian",
        contact: { phone: "+91 90000 00000" },
        isPrimary: true,
        isEmergencyContact: true,
        authorizedPickup: true,
        communicationPreference: "whatsapp",
      },
    ],
    address: { line1: "1 Test Street", city: "Bengaluru", state: "Karnataka", postalCode: "560001", country: "India" },
    transport: { required: false },
    hostel: { required: false },
    feeDetails: { applicationFeePaid: true },
    documents: [
      { id: "d1", ownerId: "app-test-1", type: "birth-certificate", status: "approved", versions: [] },
      { id: "d2", ownerId: "app-test-1", type: "identity-proof", status: "approved", versions: [] },
      { id: "d3", ownerId: "app-test-1", type: "student-photo", status: "approved", versions: [] },
    ],
    notes: [],
    payments: [],
    timeline: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function baseInput(overrides: Partial<EnrollmentInput> = {}): EnrollmentInput {
  const schoolClass = schoolClasses[3];
  const section = schoolClass.sections[0];
  return {
    applicationId: "app-test-1",
    admissionNumber: "NIS-UNIQUE-0001",
    classId: schoolClass.id,
    sectionId: section.id,
    rollNumber: "12",
    joiningDate: "2026-06-01",
    feeStructureId: `fee-${schoolClass.id}`,
    createParentPortal: true,
    ...overrides,
  };
}

describe("validateEnrollment", () => {
  beforeEach(() => resetDemoData());

  it("passes for a complete, valid enrollment input", () => {
    const result = validateEnrollment(baseApplication(), baseInput(), getSnapshot());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects a duplicate admission number", () => {
    const db = getSnapshot();
    const existingNumber = db.students[0].admissionNumber;
    const result = validateEnrollment(baseApplication(), baseInput({ admissionNumber: existingNumber }), db);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("already in use"))).toBe(true);
  });

  it("rejects enrollment when the section is at capacity", () => {
    const schoolClass = schoolClasses[3];
    const section = schoolClass.sections[0];
    const db = getSnapshot();
    // Fill the section to capacity with synthetic active students.
    const filledStudents = Array.from({ length: section.capacity }, (_, i) => ({
      ...db.students[0],
      id: `filler-${i}`,
      admissionNumber: `FILLER-${i}`,
      sectionId: section.id,
      status: "active" as const,
    }));
    const fullDb = { ...db, students: [...db.students, ...filledStudents] };

    const result = validateEnrollment(baseApplication(), baseInput(), fullDb);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("at capacity"))).toBe(true);
  });

  it("rejects enrollment when the application has no primary guardian", () => {
    const app = baseApplication({ guardians: [{ ...baseApplication().guardians[0], isPrimary: false }] });
    const result = validateEnrollment(app, baseInput(), getSnapshot());
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("primary guardian"))).toBe(true);
  });

  it("rejects enrollment when required documents are not approved", () => {
    const app = baseApplication({
      documents: [{ id: "d1", ownerId: "app-test-1", type: "birth-certificate", status: "missing", versions: [] }],
    });
    const result = validateEnrollment(app, baseInput(), getSnapshot());
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("required document"))).toBe(true);
  });

  it("rejects enrollment without a fee structure selected", () => {
    const result = validateEnrollment(baseApplication(), baseInput({ feeStructureId: "" }), getSnapshot());
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("fee structure"))).toBe(true);
  });

  it("rejects re-converting an already-converted application", () => {
    const app = baseApplication({ convertedStudentId: "student-already-exists" });
    const result = validateEnrollment(app, baseInput(), getSnapshot());
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("already been converted"))).toBe(true);
  });
});

describe("convertApplicationToStudent", () => {
  beforeEach(() => resetDemoData());

  it("creates a student, guardian, and links, and marks the application enrolled", () => {
    resetDemoData();
    const app = baseApplication();
    // Seed the application into the store so convertApplicationToStudent (which reads getSnapshot()) can find it.
    const db = getSnapshot();
    db.applications.unshift(app);

    const result = convertApplicationToStudent(baseInput());
    expect("studentId" in result).toBe(true);
    if ("studentId" in result) {
      const student = getSnapshot().students.find((s) => s.id === result.studentId);
      expect(student).toBeDefined();
      expect(student?.admissionNumber).toBe("NIS-UNIQUE-0001");
      expect(student?.status).toBe("active");

      const updatedApp = getSnapshot().applications.find((a) => a.id === app.id);
      expect(updatedApp?.stage).toBe("enrolled");
      expect(updatedApp?.convertedStudentId).toBe(result.studentId);
    }
  });
});
