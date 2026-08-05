import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { approveLessonPlan, createLessonPlan, rejectLessonPlan, submitForApproval } from "./lesson-plan-service";

function baseInput() {
  const db = getSnapshot();
  const assignment = db.subjectAssignments[0];
  return {
    teacherId: assignment.primaryTeacherId,
    classId: assignment.classId,
    sectionId: assignment.sectionId,
    subjectId: assignment.subjectId,
    date: new Date().toISOString(),
    period: 1,
    learningObjective: "Understand the topic",
    teachingMethod: "Lecture",
    materials: "Textbook",
    activity: "Guided practice",
  };
}

describe("lesson plan submission workflow", () => {
  beforeEach(() => resetDemoData());

  it("creates a lesson plan as a draft", () => {
    const plan = createLessonPlan(baseInput());
    expect(plan.status).toBe("draft");
    expect(getSnapshot().lessonPlans.some((p) => p.id === plan.id)).toBe(true);
  });

  it("moves a draft to submitted", () => {
    const plan = createLessonPlan(baseInput());
    submitForApproval(plan.id);
    expect(getSnapshot().lessonPlans.find((p) => p.id === plan.id)?.status).toBe("submitted");
  });

  it("approves a submitted plan with a reviewer recorded", () => {
    const plan = createLessonPlan(baseInput());
    submitForApproval(plan.id);
    approveLessonPlan(plan.id, "Academic Coordinator", "Looks good");

    const updated = getSnapshot().lessonPlans.find((p) => p.id === plan.id);
    expect(updated?.status).toBe("approved");
    expect(updated?.reviewedBy).toBe("Academic Coordinator");
  });

  it("rejects a submitted plan with a comment", () => {
    const plan = createLessonPlan(baseInput());
    submitForApproval(plan.id);
    rejectLessonPlan(plan.id, "Academic Coordinator", "Needs more detail");

    const updated = getSnapshot().lessonPlans.find((p) => p.id === plan.id);
    expect(updated?.status).toBe("rejected");
    expect(updated?.reviewComment).toBe("Needs more detail");
  });
});
