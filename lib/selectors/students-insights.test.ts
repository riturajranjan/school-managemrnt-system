import { describe, expect, it } from "vitest";
import { activeStudentCount, attendanceRiskCount, feeRiskCount, genderSplit } from "./students-insights";
import type { Student } from "@/lib/types/students";

function makeStudent(overrides: Partial<Student>): Student {
  return {
    id: "s1",
    admissionNumber: "A1",
    profile: { firstName: "Test", lastName: "Student", dob: "2016-01-01", gender: "male", nationality: "Indian" },
    classId: "class-1",
    sectionId: "class-1-a",
    session: "2026-2027",
    branchId: "main",
    status: "active",
    admissionDate: new Date().toISOString(),
    admissionType: "new",
    address: { line1: "", city: "", state: "", postalCode: "", country: "India" },
    guardianIds: [],
    primaryGuardianId: "g1",
    academics: { overallPercent: 80, trend: "flat", upcomingExams: [], recentHomework: [], subjectsAtRisk: [] },
    attendance: { presentPercent: 90, presentDays: 0, absentDays: 0, lateDays: 0, totalDays: 0, todayStatus: "present", trend7Day: [] },
    fees: { status: "paid", totalDue: 0, totalPaid: 0, overdueAmount: 0 },
    health: { emergencyContactName: "", emergencyContactPhone: "", allergies: [], conditions: [], medications: [] },
    behaviourNotes: [],
    pulse: { overallScore: 80, status: "good", positiveTrend: "", mainRisk: "", suggestedAction: "", explanation: "", dimensions: [] },
    documents: [],
    timeline: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("activeStudentCount", () => {
  it("counts only students with active status", () => {
    const students = [makeStudent({ id: "a", status: "active" }), makeStudent({ id: "b", status: "archived" }), makeStudent({ id: "c", status: "active" })];
    expect(activeStudentCount(students)).toBe(2);
  });
});

describe("attendanceRiskCount", () => {
  it("counts active students below the attendance threshold", () => {
    const students = [
      makeStudent({ id: "a", attendance: { ...makeStudent({}).attendance, presentPercent: 60 } }),
      makeStudent({ id: "b", attendance: { ...makeStudent({}).attendance, presentPercent: 95 } }),
      makeStudent({ id: "c", status: "archived", attendance: { ...makeStudent({}).attendance, presentPercent: 40 } }),
    ];
    expect(attendanceRiskCount(students, 75)).toBe(1);
  });
});

describe("feeRiskCount", () => {
  it("counts active students with overdue or partial fee status", () => {
    const students = [
      makeStudent({ id: "a", fees: { status: "overdue", totalDue: 100, totalPaid: 0, overdueAmount: 100 } }),
      makeStudent({ id: "b", fees: { status: "partial", totalDue: 100, totalPaid: 50, overdueAmount: 0 } }),
      makeStudent({ id: "c", fees: { status: "paid", totalDue: 100, totalPaid: 100, overdueAmount: 0 } }),
    ];
    expect(feeRiskCount(students)).toBe(2);
  });
});

describe("genderSplit", () => {
  it("tallies boys, girls, and other separately", () => {
    const students = [
      makeStudent({ id: "a", profile: { ...makeStudent({}).profile, gender: "male" } }),
      makeStudent({ id: "b", profile: { ...makeStudent({}).profile, gender: "female" } }),
      makeStudent({ id: "c", profile: { ...makeStudent({}).profile, gender: "female" } }),
    ];
    expect(genderSplit(students)).toEqual({ boys: 1, girls: 2, other: 0 });
  });
});
