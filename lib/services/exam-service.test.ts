import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { createExam, deleteExam, setExamStatus } from "./exam-service";
import { addExamSubject, toggleExamSubjectLock, updateExamSubject, validateExamSubject } from "./exam-subject-service";

const ACTOR = { name: "Examination Controller", role: "Examination Controller" };

function baseExamInput() {
  return {
    name: "Weekly Test 4",
    code: "WT4-2627",
    type: "weekly-test" as const,
    session: "2026-2027",
    branchId: "main",
    term: "Term 1",
    startDate: "2026-09-10",
    endDate: "2026-09-10",
    scope: "internal" as const,
    mode: "offline" as const,
    classIds: [],
    notifyOnPublish: true,
    createdBy: ACTOR.name,
  };
}

describe("exam-service", () => {
  beforeEach(() => {
    resetDemoData();
  });

  it("creates an exam as a draft", () => {
    const exam = createExam(baseExamInput(), ACTOR);
    expect(exam.status).toBe("draft");
    expect(getSnapshot().exams.some((e) => e.id === exam.id)).toBe(true);
  });

  it("moves an exam through statuses and logs the change", () => {
    const exam = createExam(baseExamInput(), ACTOR);
    setExamStatus(exam.id, "scheduled", ACTOR);
    const updated = getSnapshot().exams.find((e) => e.id === exam.id);
    expect(updated?.status).toBe("scheduled");
    expect(getSnapshot().examAuditLog.some((e) => e.examId === exam.id)).toBe(true);
  });

  it("refuses to delete an exam that has moved past draft", () => {
    const exam = createExam(baseExamInput(), ACTOR);
    setExamStatus(exam.id, "scheduled", ACTOR);
    const result = deleteExam(exam.id);
    expect(result.ok).toBe(false);
  });

  it("deletes a draft exam with no subjects configured", () => {
    const exam = createExam(baseExamInput(), ACTOR);
    const result = deleteExam(exam.id);
    expect(result.ok).toBe(true);
    expect(getSnapshot().exams.some((e) => e.id === exam.id)).toBe(false);
  });
});

describe("exam-subject-service", () => {
  beforeEach(() => {
    resetDemoData();
  });

  it("rejects a subject whose components don't add up to the maximum", () => {
    const errors = validateExamSubject({ maxMarks: 100, passingMarks: 33, theoryMarks: 70, practicalMarks: 20, internalMarks: 0, projectMarks: 0, graceMarksLimit: 5 });
    expect(errors.some((e) => e.includes("add up"))).toBe(true);
  });

  it("rejects passing marks above the maximum", () => {
    const errors = validateExamSubject({ maxMarks: 100, passingMarks: 120, theoryMarks: 100, practicalMarks: 0, internalMarks: 0, projectMarks: 0, graceMarksLimit: 5 });
    expect(errors.some((e) => e.includes("exceed"))).toBe(true);
  });

  it("accepts a correctly balanced configuration", () => {
    const errors = validateExamSubject({ maxMarks: 100, passingMarks: 33, theoryMarks: 100, practicalMarks: 0, internalMarks: 0, projectMarks: 0, graceMarksLimit: 5 });
    expect(errors).toHaveLength(0);
  });

  it("prevents adding a duplicate subject to the same section", () => {
    const db = getSnapshot();
    const exam = db.exams.find((e) => e.status === "scheduled" || e.status === "verification");
    if (!exam) return;
    const existing = db.examSubjects.find((s) => s.examId === exam.id);
    if (!existing) return;
    const result = addExamSubject(exam.id, existing.classId, existing.sectionId, existing.subjectId, { maxMarks: 100, passingMarks: 33, theoryMarks: 100, practicalMarks: 0 });
    expect("errors" in result).toBe(true);
  });

  it("refuses to update a locked exam subject", () => {
    const db = getSnapshot();
    const unlocked = db.examSubjects.find((s) => !s.locked);
    if (!unlocked) return;
    toggleExamSubjectLock(unlocked.id, ACTOR);
    const result = updateExamSubject(unlocked.id, { instructions: "Updated instructions" });
    expect(result.valid).toBe(false);
  });
});
