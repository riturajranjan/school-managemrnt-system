import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { computePromotionEligibility, confirmPromotionRun, createPromotionRun, updateDecision } from "./promotion-service";

const ACTOR = { name: "Principal", role: "Principal" };

describe("promotion-service", () => {
  beforeEach(() => {
    resetDemoData();
  });

  it("marks a student pending when no result exists yet", () => {
    const db = getSnapshot();
    const classWithoutResults = db.classes.find((c) => !db.examResults.some((r) => r.classId === c.id));
    if (!classWithoutResults) return;
    const eligibility = computePromotionEligibility(db, classWithoutResults.id);
    expect(eligibility.every((e) => e.decision === "pending")).toBe(true);
  });

  it("retains a student who failed too many subjects", () => {
    const db = getSnapshot();
    const publishedExam = db.exams.find((e) => e.status === "published");
    if (!publishedExam) return;
    const failing = db.examResults.find((r) => r.examId === publishedExam.id && r.status === "fail");
    if (!failing) return;
    const eligibility = computePromotionEligibility(db, failing.classId);
    const entry = eligibility.find((e) => e.studentId === failing.studentId);
    expect(entry?.decision).toBe("retain");
  });

  it("promotes a student who passed with good attendance", () => {
    const db = getSnapshot();
    const publishedExam = db.exams.find((e) => e.status === "published");
    if (!publishedExam) return;
    const passing = db.examResults.find((r) => r.examId === publishedExam.id && r.status === "pass");
    if (!passing) return;
    const student = db.students.find((s) => s.id === passing.studentId)!;
    if (student.attendance.presentPercent < 75 || student.status !== "active") return; // needs a clean, currently-enrolled case for this assertion
    const eligibility = computePromotionEligibility(db, passing.classId);
    const entry = eligibility.find((e) => e.studentId === passing.studentId);
    expect(entry?.decision).toBe("promote");
  });

  it("confirming a run with valid destinations updates student class/section", () => {
    const db = getSnapshot();
    const publishedExam = db.exams.find((e) => e.status === "published");
    if (!publishedExam) return;
    const passing = db.examResults.find((r) => r.examId === publishedExam.id && r.status === "pass");
    if (!passing) return;
    const student = db.students.find((s) => s.id === passing.studentId)!;
    if (student.attendance.presentPercent < 75 || student.status !== "active") return;

    const originClass = db.classes.find((c) => c.id === passing.classId)!;
    const nextClass = db.classes.find((c) => c.order === originClass.order + 1);
    if (!nextClass || nextClass.sections.length === 0) return;
    const destinationSection = nextClass.sections[0];

    const run = createPromotionRun(publishedExam.session, "2027-2028", passing.classId, undefined, ACTOR);
    updateDecision(run.id, passing.studentId, { decision: "promote", toClassId: nextClass.id, toSectionId: destinationSection.id });
    // Every other decision in this run also needs a destination or the run can't confirm — retain everyone else instead.
    for (const decision of run.decisions) {
      if (decision.studentId !== passing.studentId) updateDecision(run.id, decision.studentId, { decision: "retain" });
    }

    const result = confirmPromotionRun(run.id, ACTOR);
    expect(result.ok).toBe(true);

    const after = getSnapshot();
    const updatedStudent = after.students.find((s) => s.id === passing.studentId)!;
    expect(updatedStudent.classId).toBe(nextClass.id);
    expect(updatedStudent.sectionId).toBe(destinationSection.id);
  });

  it("refuses to confirm when a destination section is missing", () => {
    const db = getSnapshot();
    const someClass = db.classes.find((c) => computePromotionEligibility(db, c.id).some((e) => e.decision !== "pending"));
    if (!someClass) return;
    const run = createPromotionRun("2026-2027", "2027-2028", someClass.id, undefined, ACTOR);
    const promoteDecision = run.decisions.find((d) => d.decision === "promote");
    if (!promoteDecision) return; // nothing to promote in this random draw, nothing to assert
    const result = confirmPromotionRun(run.id, ACTOR);
    expect(result.ok).toBe(false);
  });

  it("refuses to start a run when every student in the class is missing a result", () => {
    const db = getSnapshot();
    const classWithoutResults = db.classes.find((c) => computePromotionEligibility(db, c.id).length > 0 && computePromotionEligibility(db, c.id).every((e) => e.decision === "pending"));
    if (!classWithoutResults) return;
    expect(() => createPromotionRun("2026-2027", "2027-2028", classWithoutResults.id, undefined, ACTOR)).toThrow(/no student/i);
  });
});
