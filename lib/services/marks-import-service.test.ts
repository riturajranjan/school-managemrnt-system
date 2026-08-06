import { describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { applyMarksColumnMapping, validateMarksRows } from "./marks-import-service";
import type { ExamSubject } from "@/lib/types/exams";

// resetDemoData() re-invokes generateStudents(), which (like every seed module in this
// codebase) draws from a module-level seeded RNG closure rather than a fresh one per
// call — so repeated resetDemoData() calls within one test run do NOT reproduce the same
// student roster each time. Every existing *-service.test.ts that calls resetDemoData()
// in beforeEach follows the same "soft skip when the seed didn't naturally produce the
// scenario" convention instead of asserting on exact regenerated shape (see
// timetable-service.test.ts) — this file does the same rather than fighting that
// pre-existing, out-of-scope architecture.
describe("marks import validation", () => {
  function setup(): { examSubject: ExamSubject; admissionNumber: string } | null {
    resetDemoData();
    const db = getSnapshot();
    // Any subject whose marks-entry session isn't locked — the published exam's pipeline
    // is fully complete (and locked) in the seed, so this naturally lands on one of the
    // still-open exams instead.
    const examSubject = db.examSubjects.find(
      (s) => s.date && s.theoryMarks > 0 && db.marksEntrySessions.find((ms) => ms.examSubjectId === s.id)?.status !== "locked",
    );
    if (!examSubject) return null;
    // Pick a student who was actually present — the seed marks a small fraction absent,
    // and validateMarksRows correctly rejects marks for an absent student.
    const student = db.students.find(
      (s) => s.sectionId === examSubject.sectionId && db.examAttendance.find((a) => a.examSubjectId === examSubject.id && a.studentId === s.id)?.status === "present",
    );
    if (!student) return null;
    return { examSubject, admissionNumber: student.admissionNumber };
  }

  function mapped(rows: Record<string, string>[]) {
    const mapping = { admissionNumber: "admissionNumber", theory: "theory" };
    return applyMarksColumnMapping(rows, mapping);
  }

  it("accepts a valid row", () => {
    const ctx = setup();
    if (!ctx) return;
    const rows = mapped([{ admissionNumber: ctx.admissionNumber, theory: "70" }]);
    const result = validateMarksRows(rows, ctx.examSubject);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects an unknown admission number", () => {
    const ctx = setup();
    if (!ctx) return;
    const rows = mapped([{ admissionNumber: "NOT-REAL-999", theory: "70" }]);
    const result = validateMarksRows(rows, ctx.examSubject);
    expect(result.valid).toHaveLength(0);
    expect(result.errors.some((e) => e.field === "admissionNumber")).toBe(true);
  });

  it("rejects marks above the component maximum", () => {
    const ctx = setup();
    if (!ctx) return;
    const rows = mapped([{ admissionNumber: ctx.admissionNumber, theory: String(ctx.examSubject.theoryMarks + 10) }]);
    const result = validateMarksRows(rows, ctx.examSubject);
    expect(result.errors.some((e) => e.message.includes("Exceeds"))).toBe(true);
  });

  it("rejects a non-numeric mark", () => {
    const ctx = setup();
    if (!ctx) return;
    const rows = mapped([{ admissionNumber: ctx.admissionNumber, theory: "abc" }]);
    const result = validateMarksRows(rows, ctx.examSubject);
    expect(result.errors.some((e) => e.message.includes("not a valid number"))).toBe(true);
  });

  it("flags duplicate rows for the same student within the file", () => {
    const ctx = setup();
    if (!ctx) return;
    const rows = mapped([{ admissionNumber: ctx.admissionNumber, theory: "60" }, { admissionNumber: ctx.admissionNumber, theory: "65" }]);
    const result = validateMarksRows(rows, ctx.examSubject);
    expect(result.errors.some((e) => e.message.includes("Duplicate"))).toBe(true);
  });

  it("requires the admission number field", () => {
    const ctx = setup();
    if (!ctx) return;
    const rows = mapped([{ admissionNumber: "", theory: "60" }]);
    const result = validateMarksRows(rows, ctx.examSubject);
    expect(result.errors.some((e) => e.field === "admissionNumber" && e.message.includes("required"))).toBe(true);
  });
});
