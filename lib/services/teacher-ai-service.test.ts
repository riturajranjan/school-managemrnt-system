import { describe, expect, it } from "vitest";
import { generateRemarkSuggestion } from "./teacher-ai-service";

describe("generateRemarkSuggestion", () => {
  it("uses positive language for a strong result", () => {
    const result = generateRemarkSuggestion({ studentName: "Aarav", percent: 92, attendancePercent: 98, failedSubjectCount: 0, strongestSubject: "Mathematics" });
    expect(result.text).toContain("excellent");
    expect(result.text).toContain("Mathematics");
    expect(result.influencedBy).toContain("Overall result: 92%");
  });

  it("stays constructive (not negative) for a struggling result", () => {
    const result = generateRemarkSuggestion({ studentName: "Priya", percent: 38, attendancePercent: 70, failedSubjectCount: 2, weakestSubject: "Science" });
    expect(result.text).not.toMatch(/fail|bad|poor|weak student/i);
    expect(result.text).toContain("Science");
    expect(result.influencedBy.some((f) => f.includes("2 subject"))).toBe(true);
  });

  it("mentions improvement when percent increased vs previous exam", () => {
    const result = generateRemarkSuggestion({ studentName: "Rohan", percent: 70, attendancePercent: 90, failedSubjectCount: 0, percentDeltaVsPrevious: 8 });
    expect(result.text).toMatch(/improvement/i);
    expect(result.influencedBy).toContain("+8% vs previous exam");
  });

  it("flags low attendance as an influencing factor", () => {
    const result = generateRemarkSuggestion({ studentName: "Meera", percent: 55, attendancePercent: 60, failedSubjectCount: 0 });
    expect(result.text).toContain("Attendance");
    expect(result.influencedBy.some((f) => f.includes("Exam attendance: 60%"))).toBe(true);
  });

  it("does not mention attendance when it is healthy", () => {
    const result = generateRemarkSuggestion({ studentName: "Kabir", percent: 80, attendancePercent: 95, failedSubjectCount: 0 });
    expect(result.influencedBy.some((f) => f.startsWith("Exam attendance"))).toBe(false);
  });
});
