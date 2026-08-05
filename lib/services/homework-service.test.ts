import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { createHomework, gradeSubmission, publishHomework, submitHomework } from "./homework-service";

function baseHomeworkInput() {
  const db = getSnapshot();
  const assignment = db.subjectAssignments.find((a) => db.students.some((s) => s.sectionId === a.sectionId && s.status === "active"))!;
  return {
    title: "Test homework",
    description: "Practice problems",
    classId: assignment.classId,
    sectionId: assignment.sectionId,
    subjectId: assignment.subjectId,
    teacherId: assignment.primaryTeacherId,
    assignedDate: new Date().toISOString(),
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    maxMarks: 10,
    instructions: "Complete all questions",
    submissionType: "text" as const,
    allowLateSubmission: true,
    requireParentAcknowledgement: false,
    visibility: "section" as const,
  };
}

describe("homework publishing", () => {
  beforeEach(() => resetDemoData());

  it("creates homework as a draft", () => {
    const hw = createHomework(baseHomeworkInput());
    expect(hw.status).toBe("draft");
  });

  it("publishes a draft homework", () => {
    const hw = createHomework(baseHomeworkInput());
    publishHomework(hw.id);
    expect(getSnapshot().homework.find((h) => h.id === hw.id)?.status).toBe("published");
  });
});

describe("homework submission", () => {
  beforeEach(() => resetDemoData());

  it("creates a new submission with 'submitted' status when before the due date", () => {
    const hw = createHomework(baseHomeworkInput());
    publishHomework(hw.id);
    const student = getSnapshot().students.find((s) => s.sectionId === hw.sectionId)!;

    submitHomework(hw.id, student.id, "My answer", []);

    const submission = getSnapshot().homeworkSubmissions.find((s) => s.homeworkId === hw.id && s.studentId === student.id);
    expect(submission?.status).toBe("submitted");
    expect(submission?.content).toBe("My answer");
  });

  it("marks a resubmission as late once the due date has passed", () => {
    const input = { ...baseHomeworkInput(), dueDate: new Date(Date.now() - 86400000).toISOString() };
    const hw = createHomework(input);
    publishHomework(hw.id);
    const student = getSnapshot().students.find((s) => s.sectionId === hw.sectionId)!;

    submitHomework(hw.id, student.id, "Late answer", []);

    const submission = getSnapshot().homeworkSubmissions.find((s) => s.homeworkId === hw.id && s.studentId === student.id);
    expect(submission?.status).toBe("late");
  });

  it("updates the existing submission instead of duplicating it on resubmission", () => {
    const hw = createHomework(baseHomeworkInput());
    publishHomework(hw.id);
    const student = getSnapshot().students.find((s) => s.sectionId === hw.sectionId)!;

    submitHomework(hw.id, student.id, "First try", []);
    submitHomework(hw.id, student.id, "Second try", []);

    const submissions = getSnapshot().homeworkSubmissions.filter((s) => s.homeworkId === hw.id && s.studentId === student.id);
    expect(submissions).toHaveLength(1);
    expect(submissions[0].content).toBe("Second try");
  });
});

describe("gradeSubmission", () => {
  beforeEach(() => resetDemoData());

  it("marks a submission evaluated with marks and feedback", () => {
    const hw = createHomework(baseHomeworkInput());
    publishHomework(hw.id);
    const student = getSnapshot().students.find((s) => s.sectionId === hw.sectionId)!;
    submitHomework(hw.id, student.id, "Answer", []);
    const submission = getSnapshot().homeworkSubmissions.find((s) => s.homeworkId === hw.id && s.studentId === student.id)!;

    gradeSubmission(submission.id, 8, "Well done");

    const graded = getSnapshot().homeworkSubmissions.find((s) => s.id === submission.id);
    expect(graded?.status).toBe("evaluated");
    expect(graded?.marksObtained).toBe(8);
    expect(graded?.feedback).toBe("Well done");
  });
});
