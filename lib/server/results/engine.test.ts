// Result-engine unit tests (Phase 8C) — pure functions, no DB. Exhaustively
// covers the documented V1 policy (lib/server/results/engine.ts): zero as a
// real mark, ABSENT/EXEMPT semantics, incomplete detection, split vs.
// non-split papers, grading boundary/gap/overlap resolution, and rounding.
import { describe, expect, it } from "vitest";
import { computeOverallResult, computeSubjectResult, resolveGrade, validateGradingBands, type MarkForResult, type ScheduleEntryForResult } from "./engine";

const entry: ScheduleEntryForResult = { id: "e1", subjectId: "s1", subjectName: "Math", subjectCode: "MATH", maxMarks: 100, passingMarks: 33 };
const splitEntry: ScheduleEntryForResult = { id: "e2", subjectId: "s2", subjectName: "Science", subjectCode: "SCI", maxMarks: 100, passingMarks: 33 };
const bands = [
  { label: "A1", minPercent: 91, maxPercent: 100 },
  { label: "A2", minPercent: 81, maxPercent: 90 },
  { label: "B1", minPercent: 71, maxPercent: 80 },
  { label: "C", minPercent: 33, maxPercent: 70 },
  { label: "F", minPercent: 0, maxPercent: 32 },
];

function mark(patch: Partial<MarkForResult>): MarkForResult {
  return { sheetStatus: "VERIFIED", markStatus: "marked", theoryMarks: null, practicalMarks: null, marksObtained: null, ...patch };
}

describe("computeSubjectResult", () => {
  it("no sheet yet -> pending/incomplete", () => {
    const r = computeSubjectResult(entry, { sheetStatus: null, markStatus: null, theoryMarks: null, practicalMarks: null, marksObtained: null }, bands);
    expect(r).toMatchObject({ markStatus: "pending", passStatus: "incomplete", marksObtained: null, percentage: null, grade: null });
  });

  it("sheet DRAFT/SUBMITTED (not VERIFIED) -> unverified/incomplete", () => {
    const r = computeSubjectResult(entry, mark({ sheetStatus: "SUBMITTED" }), bands);
    expect(r.markStatus).toBe("unverified");
    expect(r.passStatus).toBe("incomplete");
  });

  it("VERIFIED sheet but this student's row is still PENDING -> pending/incomplete", () => {
    const r = computeSubjectResult(entry, mark({ markStatus: "pending" }), bands);
    expect(r).toMatchObject({ markStatus: "pending", passStatus: "incomplete" });
  });

  it("ABSENT is never zero", () => {
    const r = computeSubjectResult(entry, mark({ markStatus: "absent" }), bands);
    expect(r).toMatchObject({ markStatus: "absent", passStatus: "absent", marksObtained: null, percentage: null, grade: null });
  });

  it("EXEMPT is never zero and carries no grade", () => {
    const r = computeSubjectResult(entry, mark({ markStatus: "exempt" }), bands);
    expect(r).toMatchObject({ markStatus: "exempt", passStatus: "exempt", marksObtained: null, percentage: null, grade: null });
  });

  it("MARKED 0 is a real, persisted, participating score — not missing", () => {
    const r = computeSubjectResult(entry, mark({ marksObtained: 0 }), bands);
    expect(r.marksObtained).toBe(0);
    expect(r.percentage).toBe(0);
    expect(r.passStatus).toBe("fail"); // 0 < passingMarks(33)
    expect(r.grade).toBe("F");
  });

  it("PASS at exactly passingMarks; FAIL one below", () => {
    expect(computeSubjectResult(entry, mark({ marksObtained: 33 }), bands).passStatus).toBe("pass");
    expect(computeSubjectResult(entry, mark({ marksObtained: 32 }), bands).passStatus).toBe("fail");
  });

  it("split paper: reads the (Phase 8B pre-computed) total, plus its components", () => {
    // Phase 8B's saveMarks always persists marksObtained = theoryMarks +
    // practicalMarks for a split paper at save time — the engine trusts that
    // stored total rather than recomputing it, so the fixture mirrors a real
    // ExamMark row exactly.
    const r = computeSubjectResult(splitEntry, mark({ theoryMarks: 45, practicalMarks: 20, marksObtained: 65 }), bands);
    expect(r.marksObtained).toBe(65);
    expect(r.percentage).toBe(65);
    expect(r.theoryMarks).toBe(45);
    expect(r.practicalMarks).toBe(20);
  });
});

describe("resolveGrade — boundary / gap / overlap", () => {
  it("resolves exactly one grade at each configured boundary", () => {
    expect(resolveGrade(100, bands)).toBe("A1");
    expect(resolveGrade(91, bands)).toBe("A1");
    expect(resolveGrade(90, bands)).toBe("A2");
    expect(resolveGrade(80, bands)).toBe("B1");
    expect(resolveGrade(71, bands)).toBe("B1");
    expect(resolveGrade(70, bands)).toBe("C");
    expect(resolveGrade(33, bands)).toBe("C");
    expect(resolveGrade(32, bands)).toBe("F");
    expect(resolveGrade(0, bands)).toBe("F");
  });

  it("a percentage in an uncovered gap fails closed (null), never guesses", () => {
    const gappy = [{ label: "Pass", minPercent: 50, maxPercent: 100 }, { label: "Fail", minPercent: 0, maxPercent: 40 }];
    expect(resolveGrade(45, gappy)).toBeNull(); // 41-49 uncovered
  });

  it("a percentage matched by overlapping bands fails closed (null), never guesses", () => {
    const overlapping = [{ label: "A", minPercent: 0, maxPercent: 60 }, { label: "B", minPercent: 50, maxPercent: 100 }];
    expect(resolveGrade(55, overlapping)).toBeNull();
  });
});

describe("validateGradingBands", () => {
  it("accepts a valid, non-overlapping, in-range set", () => {
    expect(validateGradingBands(bands.map((b, i) => ({ ...b, isPass: b.label !== "F", order: i })))).toEqual([]);
  });
  it("rejects min > max", () => {
    expect(validateGradingBands([{ label: "X", minPercent: 80, maxPercent: 70, isPass: true, order: 0 }]).length).toBeGreaterThan(0);
  });
  it("rejects an overlap", () => {
    const errs = validateGradingBands([{ label: "A", minPercent: 50, maxPercent: 100, isPass: true, order: 0 }, { label: "B", minPercent: 40, maxPercent: 60, isPass: false, order: 1 }]);
    expect(errs.some((e) => e.includes("overlaps"))).toBe(true);
  });
  it("rejects an empty set", () => {
    expect(validateGradingBands([]).length).toBeGreaterThan(0);
  });
  it("rejects out-of-range percentages", () => {
    expect(validateGradingBands([{ label: "X", minPercent: -5, maxPercent: 50, isPass: true, order: 0 }]).length).toBeGreaterThan(0);
    expect(validateGradingBands([{ label: "X", minPercent: 50, maxPercent: 150, isPass: true, order: 0 }]).length).toBeGreaterThan(0);
  });
});

describe("computeOverallResult", () => {
  it("all PASS -> PASS, percentage/grade computed across all non-exempt papers", () => {
    const subjects = [
      computeSubjectResult(entry, mark({ marksObtained: 90 }), bands),
      computeSubjectResult(splitEntry, mark({ theoryMarks: 60, practicalMarks: 20, marksObtained: 80 }), bands),
    ];
    const overall = computeOverallResult(subjects, bands);
    expect(overall.status).toBe("pass");
    expect(overall.totalMaxMarks).toBe(200);
    expect(overall.totalMarksObtained).toBe(170);
    expect(overall.percentage).toBe(85);
    expect(overall.grade).toBe("A2");
  });

  it("EXEMPT paper is excluded from BOTH numerator and denominator (200, not 300)", () => {
    const subjects = [
      computeSubjectResult(entry, mark({ marksObtained: 80 }), bands), // /100
      computeSubjectResult(splitEntry, mark({ markStatus: "exempt" }), bands), // excluded entirely
      computeSubjectResult({ ...entry, id: "e3" }, mark({ marksObtained: 70 }), bands), // /100
    ];
    const overall = computeOverallResult(subjects, bands);
    expect(overall.totalMaxMarks).toBe(200);
    expect(overall.totalMarksObtained).toBe(150);
    expect(overall.percentage).toBe(75);
  });

  it("ABSENT paper counts its full maxMarks against the student (0 obtained), unlike EXEMPT", () => {
    const subjects = [
      computeSubjectResult(entry, mark({ marksObtained: 90 }), bands), // /100
      computeSubjectResult(splitEntry, mark({ markStatus: "absent" }), bands), // 0/100, still counted
    ];
    const overall = computeOverallResult(subjects, bands);
    expect(overall.totalMaxMarks).toBe(200);
    expect(overall.totalMarksObtained).toBe(90);
    expect(overall.percentage).toBe(45);
    expect(overall.status).toBe("fail"); // absent paper fails the exam overall
  });

  it("every non-exempt paper ABSENT -> overall ABSENT (distinct from FAIL)", () => {
    const subjects = [computeSubjectResult(entry, mark({ markStatus: "absent" }), bands), computeSubjectResult(splitEntry, mark({ markStatus: "absent" }), bands)];
    expect(computeOverallResult(subjects, bands).status).toBe("absent");
  });

  it("one non-exempt paper INCOMPLETE -> overall INCOMPLETE, even if others are graded", () => {
    const subjects = [computeSubjectResult(entry, mark({ marksObtained: 90 }), bands), computeSubjectResult(splitEntry, { sheetStatus: null, markStatus: null, theoryMarks: null, practicalMarks: null, marksObtained: null }, bands)];
    expect(computeOverallResult(subjects, bands).status).toBe("incomplete");
  });

  it("zero non-exempt papers at all -> INCOMPLETE, never a silent PASS", () => {
    const subjects = [computeSubjectResult(entry, mark({ markStatus: "exempt" }), bands)];
    expect(computeOverallResult(subjects, bands).status).toBe("incomplete");
  });

  it("one FAIL among otherwise-PASS papers -> overall FAIL", () => {
    const subjects = [computeSubjectResult(entry, mark({ marksObtained: 90 }), bands), computeSubjectResult(splitEntry, mark({ theoryMarks: 10, practicalMarks: 5, marksObtained: 15 }), bands)];
    expect(computeOverallResult(subjects, bands).status).toBe("fail");
  });

  it("rounding: percentage rounds to the nearest whole percent", () => {
    const subjects = [computeSubjectResult(entry, mark({ marksObtained: 1 }), bands), computeSubjectResult(splitEntry, mark({ marksObtained: 2 }), bands)]; // 3/200 = 1.5% -> rounds to 2
    expect(computeOverallResult(subjects, bands).percentage).toBe(2);
  });
});
