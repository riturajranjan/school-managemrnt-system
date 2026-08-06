import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData, setState } from "@/lib/data/store";
import { applySupplementaryResults, createSupplementaryExam, getEligibleStudentsForReExam } from "./supplementary-service";

const ACTOR = { name: "Examination Controller", role: "Examination Controller" };

describe("supplementary-service", () => {
  beforeEach(() => {
    resetDemoData();
  });

  it("finds eligible students with at least one failed subject", () => {
    const db = getSnapshot();
    const publishedExam = db.exams.find((e) => e.status === "published");
    if (!publishedExam) return;
    const eligible = getEligibleStudentsForReExam(publishedExam.id);
    for (const e of eligible) expect(e.failedSubjectIds.length).toBeGreaterThan(0);
  });

  it("creates a supplementary exam scoped only to failed subjects, linked to the original", () => {
    const db = getSnapshot();
    const publishedExam = db.exams.find((e) => e.status === "published");
    if (!publishedExam) return;
    const eligible = getEligibleStudentsForReExam(publishedExam.id);
    if (eligible.length === 0) return;

    const created = createSupplementaryExam(publishedExam.id, "re-test", eligible.slice(0, 1), { startDate: "2026-09-01", endDate: "2026-09-02" }, ACTOR);
    expect(created).not.toBeNull();
    if (!created) return;
    expect(created.parentExamId).toBe(publishedExam.id);
    expect(created.status).toBe("draft");

    const after = getSnapshot();
    const subjects = after.examSubjects.filter((s) => s.examId === created.id);
    const failedCount = eligible[0].failedSubjectIds.length;
    expect(subjects.length).toBe(failedCount);
    const examClass = after.examClasses.find((c) => c.examId === created.id);
    expect(examClass).toBeDefined();
    // Every other student in that section should be excluded — only the selected re-take student is eligible.
    expect(examClass!.excludedStudentIds.length).toBeGreaterThan(0);
  });

  it("merges supplementary results back into the original without discarding history", () => {
    const db = getSnapshot();
    const publishedExam = db.exams.find((e) => e.status === "published");
    if (!publishedExam) return;
    const eligible = getEligibleStudentsForReExam(publishedExam.id);
    if (eligible.length === 0) return;

    const student = eligible[0];
    const originalBefore = db.examResults.find((r) => r.examId === publishedExam.id && r.studentId === student.studentId)!;

    // Simulate a full retake result for the supplementary exam directly (bypassing the full pipeline).
    const created = createSupplementaryExam(publishedExam.id, "re-test", [student], { startDate: "2026-09-01", endDate: "2026-09-02" }, ACTOR)!;
    const supSubjects = getSnapshot().examSubjects.filter((s) => s.examId === created.id);

    const passingSubjectResults = supSubjects.map((s) => ({
      examSubjectId: s.id,
      subjectId: s.subjectId,
      graceApplied: 0,
      total: s.maxMarks,
      maxMarks: s.maxMarks,
      percent: 100,
      grade: "A1",
      status: "pass" as const,
    }));

    // Directly stub in a calculated supplementary result (bypassing the marks-entry UI, which the pure engine already covers elsewhere).
    setState((db2) => ({
      ...db2,
      examResults: [
        ...db2.examResults,
        {
          id: "test-supp-result",
          examId: created.id,
          studentId: student.studentId,
          classId: student.classId,
          sectionId: student.sectionId,
          subjectResults: passingSubjectResults,
          totalObtained: passingSubjectResults.reduce((sum, s) => sum + s.total, 0),
          totalMax: passingSubjectResults.reduce((sum, s) => sum + s.maxMarks, 0),
          percent: 100,
          grade: "A1",
          status: "pass",
          failedSubjectCount: 0,
          attendancePercent: 100,
          eligibleForRank: false,
          calculationVersion: 1,
          calculatedAt: new Date().toISOString(),
          appliedRuleId: "rr-standard",
          explanation: [],
        },
      ],
    }));

    const { updated } = applySupplementaryResults(created.id, ACTOR);
    expect(updated).toBe(1);

    const after = getSnapshot();
    const originalAfter = after.examResults.find((r) => r.examId === publishedExam.id && r.studentId === student.studentId)!;
    expect(originalAfter.calculationVersion).toBe(originalBefore.calculationVersion + 1);
    // The retaken subjects should now be passing.
    for (const subjectId of student.failedSubjectIds) {
      const sr = originalAfter.subjectResults.find((s) => s.subjectId === subjectId);
      expect(sr?.status).toBe("pass");
    }
    // The original version is preserved in history.
    const archived = after.resultVersions.find((v) => v.examId === publishedExam.id && v.studentId === student.studentId && v.version === originalBefore.calculationVersion);
    expect(archived).toBeDefined();
  });
});
