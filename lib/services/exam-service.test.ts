import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { createExam, deleteExam, setExamStatus } from "./exam-service";

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
