import { describe, expect, it } from "vitest";
import { assignRanks, calculateStudentResult, gradeForPercent, validateGradeRanges } from "./result-engine";
import type { GradeRange, GradingScheme, ResultRule } from "@/lib/types/grading";
import type { ExamAttendanceRecord, ExamSubject } from "@/lib/types/exams";
import type { StudentMark } from "@/lib/types/marks";
import type { StudentResult } from "@/lib/types/results";

const ranges: GradeRange[] = [
  { id: "a", name: "A", minPercent: 75, maxPercent: 100, gradePoint: 9, color: "#000", isPass: true, order: 1 },
  { id: "b", name: "B", minPercent: 50, maxPercent: 74, gradePoint: 7, color: "#000", isPass: true, order: 2 },
  { id: "c", name: "C", minPercent: 33, maxPercent: 49, gradePoint: 5, color: "#000", isPass: true, order: 3 },
  { id: "f", name: "F", minPercent: 0, maxPercent: 32, gradePoint: 0, color: "#000", isPass: false, order: 4 },
];

const scheme: GradingScheme = { id: "gs-1", name: "Test scheme", system: "letter", session: "2026-2027", applicableClassIds: [], applicableSubjectIds: [], status: "active", ranges, createdAt: "", updatedAt: "" };

const rule: ResultRule = {
  id: "rr-1",
  name: "Test rule",
  gradingSchemeId: "gs-1",
  maxFailedSubjects: 1,
  graceMarksLimit: 5,
  attendanceEligibilityPercent: 75,
  rankInclusion: "pass-only",
  bestOfEnabled: false,
  roundingRule: "nearest",
  decimalPrecision: 1,
  tieBreaker: "higher-theory",
  createdAt: "",
  updatedAt: "",
};

function subject(id: string, overrides: Partial<ExamSubject> = {}): ExamSubject {
  return {
    id,
    examId: "exam-1",
    classId: "class-1",
    sectionId: "section-1",
    subjectId: `subj-${id}`,
    maxMarks: 100,
    passingMarks: 33,
    theoryMarks: 100,
    practicalMarks: 0,
    internalMarks: 0,
    projectMarks: 0,
    graceMarksLimit: 5,
    weightage: 50,
    locked: false,
    ...overrides,
  };
}

function present(examSubjectId: string): ExamAttendanceRecord {
  return { id: `att-${examSubjectId}`, examId: "exam-1", examSubjectId, studentId: "student-1", status: "present", locked: true };
}

describe("gradeForPercent", () => {
  it("finds the matching band", () => {
    expect(gradeForPercent(ranges, 80)?.name).toBe("A");
    expect(gradeForPercent(ranges, 33)?.name).toBe("C");
    expect(gradeForPercent(ranges, 0)?.name).toBe("F");
  });
});

describe("validateGradeRanges", () => {
  it("passes for non-overlapping ranges", () => {
    expect(validateGradeRanges(ranges)).toHaveLength(0);
  });

  it("flags overlapping ranges", () => {
    const overlapping: GradeRange[] = [
      { id: "a", name: "A", minPercent: 50, maxPercent: 100, gradePoint: 9, color: "#000", isPass: true, order: 1 },
      { id: "b", name: "B", minPercent: 40, maxPercent: 60, gradePoint: 7, color: "#000", isPass: true, order: 2 },
    ];
    expect(validateGradeRanges(overlapping).length).toBeGreaterThan(0);
  });
});

describe("calculateStudentResult", () => {
  it("passes a student who clears every subject", () => {
    const subjects = [subject("s1"), subject("s2")];
    const marks: StudentMark[] = [
      { id: "m1", examId: "exam-1", examSubjectId: "s1", studentId: "student-1", theory: 80, graceApplied: 0, total: 80 },
      { id: "m2", examId: "exam-1", examSubjectId: "s2", studentId: "student-1", theory: 60, graceApplied: 0, total: 60 },
    ];
    const attendance = [present("s1"), present("s2")];
    const result = calculateStudentResult({ studentId: "student-1", classId: "class-1", sectionId: "section-1", examSubjects: subjects, marks, attendance, gradingScheme: scheme, resultRule: rule, calculationVersion: 1 });
    expect(result.status).toBe("pass");
    expect(result.percent).toBe(70);
    expect(result.subjectResults.every((s) => s.status === "pass")).toBe(true);
  });

  it("applies grace marks to push a near-miss subject to a pass", () => {
    const subjects = [subject("s1")];
    const marks: StudentMark[] = [{ id: "m1", examId: "exam-1", examSubjectId: "s1", studentId: "student-1", theory: 30, graceApplied: 0, total: 30 }];
    const attendance = [present("s1")];
    const result = calculateStudentResult({ studentId: "student-1", classId: "class-1", sectionId: "section-1", examSubjects: subjects, marks, attendance, gradingScheme: scheme, resultRule: rule, calculationVersion: 1 });
    expect(result.subjectResults[0].status).toBe("pass");
    expect(result.subjectResults[0].graceApplied).toBe(3);
    expect(result.explanation.some((e) => e.includes("Grace marks applied"))).toBe(true);
  });

  it("fails a student who exceeds the max-failed-subjects limit", () => {
    const subjects = [subject("s1"), subject("s2"), subject("s3")];
    const marks: StudentMark[] = [
      { id: "m1", examId: "exam-1", examSubjectId: "s1", studentId: "student-1", theory: 10, graceApplied: 0, total: 10 },
      { id: "m2", examId: "exam-1", examSubjectId: "s2", studentId: "student-1", theory: 10, graceApplied: 0, total: 10 },
      { id: "m3", examId: "exam-1", examSubjectId: "s3", studentId: "student-1", theory: 80, graceApplied: 0, total: 80 },
    ];
    const attendance = [present("s1"), present("s2"), present("s3")];
    const result = calculateStudentResult({ studentId: "student-1", classId: "class-1", sectionId: "section-1", examSubjects: subjects, marks, attendance, gradingScheme: scheme, resultRule: rule, calculationVersion: 1 });
    expect(result.failedSubjectCount).toBe(2);
    expect(result.status).toBe("fail");
  });

  it("marks a subject absent with zero marks when attendance is absent, even if a mark row somehow exists", () => {
    const subjects = [subject("s1")];
    const marks: StudentMark[] = [{ id: "m1", examId: "exam-1", examSubjectId: "s1", studentId: "student-1", theory: 90, graceApplied: 0, total: 90 }];
    const attendance: ExamAttendanceRecord[] = [{ id: "att-s1", examId: "exam-1", examSubjectId: "s1", studentId: "student-1", status: "absent", locked: true }];
    const result = calculateStudentResult({ studentId: "student-1", classId: "class-1", sectionId: "section-1", examSubjects: subjects, marks, attendance, gradingScheme: scheme, resultRule: rule, calculationVersion: 1 });
    expect(result.subjectResults[0].status).toBe("absent");
    expect(result.subjectResults[0].total).toBe(0);
    expect(result.status).toBe("absent");
  });

  it("withholds the whole result when any subject is malpractice", () => {
    const subjects = [subject("s1"), subject("s2")];
    const marks: StudentMark[] = [{ id: "m1", examId: "exam-1", examSubjectId: "s2", studentId: "student-1", theory: 90, graceApplied: 0, total: 90 }];
    const attendance: ExamAttendanceRecord[] = [{ id: "att-s1", examId: "exam-1", examSubjectId: "s1", studentId: "student-1", status: "malpractice", locked: true }, present("s2")];
    const result = calculateStudentResult({ studentId: "student-1", classId: "class-1", sectionId: "section-1", examSubjects: subjects, marks, attendance, gradingScheme: scheme, resultRule: rule, calculationVersion: 1 });
    expect(result.status).toBe("withheld");
  });

  it("requires re-exam when attendance falls below the eligibility threshold", () => {
    const subjects = [subject("s1"), subject("s2"), subject("s3"), subject("s4")];
    const marks: StudentMark[] = subjects.map((s, i) => ({ id: `m${i}`, examId: "exam-1", examSubjectId: s.id, studentId: "student-1", theory: 80, graceApplied: 0, total: 80 }));
    const attendance: ExamAttendanceRecord[] = [
      present("s1"),
      { id: "att-s2", examId: "exam-1", examSubjectId: "s2", studentId: "student-1", status: "absent", locked: true },
      { id: "att-s3", examId: "exam-1", examSubjectId: "s3", studentId: "student-1", status: "absent", locked: true },
      { id: "att-s4", examId: "exam-1", examSubjectId: "s4", studentId: "student-1", status: "absent", locked: true },
    ];
    const result = calculateStudentResult({ studentId: "student-1", classId: "class-1", sectionId: "section-1", examSubjects: subjects, marks, attendance, gradingScheme: scheme, resultRule: rule, calculationVersion: 1 });
    expect(result.attendancePercent).toBe(25);
    expect(result.status).toBe("re-exam-required");
  });
});

describe("assignRanks", () => {
  function makeResult(id: string, percent: number, status: StudentResult["status"] = "pass"): StudentResult {
    return {
      id: `result-${id}`,
      examId: "exam-1",
      studentId: id,
      classId: "class-1",
      sectionId: "section-1",
      subjectResults: [],
      totalObtained: percent,
      totalMax: 100,
      percent,
      grade: "A",
      status,
      failedSubjectCount: 0,
      attendancePercent: 100,
      calculationVersion: 1,
      calculatedAt: "",
      appliedRuleId: "rr-1",
      explanation: [],
      rank: undefined,
      eligibleForRank: false,
    };
  }

  it("ranks by percent within a class+section group, excluding withheld/absent students", () => {
    const results = [makeResult("s1", 90), makeResult("s2", 70), makeResult("s3", 80), makeResult("s4", 60, "absent")];
    const ranked = assignRanks(results, rule, new Map());
    expect(ranked.find((r) => r.studentId === "s1")?.rank).toBe(1);
    expect(ranked.find((r) => r.studentId === "s3")?.rank).toBe(2);
    expect(ranked.find((r) => r.studentId === "s2")?.rank).toBe(3);
    expect(ranked.find((r) => r.studentId === "s4")?.eligibleForRank).toBe(false);
  });

  it("shares rank on ties when tieBreaker is none", () => {
    const noTieRule: ResultRule = { ...rule, tieBreaker: "none" };
    const results = [makeResult("s1", 80), makeResult("s2", 80), makeResult("s3", 70)];
    const ranked = assignRanks(results, noTieRule, new Map());
    expect(ranked.find((r) => r.studentId === "s1")?.rank).toBe(1);
    expect(ranked.find((r) => r.studentId === "s2")?.rank).toBe(1);
    expect(ranked.find((r) => r.studentId === "s3")?.rank).toBe(3);
  });
});
