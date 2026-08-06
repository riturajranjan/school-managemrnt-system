import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { createExam } from "./exam-service";
import { logExamAudit } from "./exam-audit-service";

const ACTOR = { name: "Examination Controller", role: "Examination Controller" };

describe("exam audit log", () => {
  beforeEach(() => {
    resetDemoData();
  });

  it("records an entry with actor, action, summary and timestamp", () => {
    logExamAudit({ examId: "exam-unit1", action: "marks-entered", actorName: ACTOR.name, actorRole: ACTOR.role, summary: "Test entry" });
    const db = getSnapshot();
    const entry = db.examAuditLog[0];
    expect(entry).toBeDefined();
    expect(entry.actorName).toBe(ACTOR.name);
    expect(entry.action).toBe("marks-entered");
    expect(entry.summary).toBe("Test entry");
    expect(entry.createdAt).toBeTruthy();
  });

  it("newest entries are prepended so the most recent activity shows first", () => {
    logExamAudit({ examId: "exam-unit1", action: "marks-entered", actorName: ACTOR.name, actorRole: ACTOR.role, summary: "First" });
    logExamAudit({ examId: "exam-unit1", action: "marks-modified", actorName: ACTOR.name, actorRole: ACTOR.role, summary: "Second" });
    const db = getSnapshot();
    expect(db.examAuditLog[0].summary).toBe("Second");
    expect(db.examAuditLog[1].summary).toBe("First");
  });

  it("creating an exam automatically logs an exam-created entry", () => {
    const exam = createExam(
      {
        name: "Test Exam",
        code: "TE-1",
        type: "unit-test",
        session: "2026-2027",
        branchId: "main",
        term: "Term 1",
        startDate: "2026-09-01",
        endDate: "2026-09-02",
        scope: "internal",
        mode: "offline",
        classIds: [],
        notifyOnPublish: true,
        createdBy: ACTOR.name,
      },
      ACTOR,
    );
    const db = getSnapshot();
    const entry = db.examAuditLog.find((e) => e.examId === exam.id && e.action === "exam-created");
    expect(entry).toBeDefined();
    expect(entry?.summary).toContain("Test Exam");
  });

  it("records an optional reason field when provided", () => {
    logExamAudit({ examId: "exam-unit1", action: "manual-override-used", actorName: ACTOR.name, actorRole: ACTOR.role, summary: "Override", reason: "Correction requested" });
    const db = getSnapshot();
    expect(db.examAuditLog[0].reason).toBe("Correction requested");
  });
});
