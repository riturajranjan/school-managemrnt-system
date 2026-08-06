import { describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";

describe("exams seed data", () => {
  it("seeds a coherent set of exams across lifecycle stages", () => {
    resetDemoData();
    const db = getSnapshot();
    const statuses = db.exams.map((e) => e.status);
    expect(statuses).toContain("published");
    expect(statuses).toContain("verification");
    expect(statuses).toContain("scheduled");
    expect(statuses).toContain("draft");
  });

  it("computes real, non-empty results and ranks for the published exam", () => {
    resetDemoData();
    const db = getSnapshot();
    const publishedExam = db.exams.find((e) => e.status === "published")!;
    const results = db.examResults.filter((r) => r.examId === publishedExam.id);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.subjectResults.length > 0)).toBe(true);
    const ranked = results.filter((r) => r.eligibleForRank);
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.some((r) => r.rank === 1)).toBe(true);
  });

  it("leaves the half-yearly exam with a mix of complete and not-started marks entry (an honest in-progress state)", () => {
    resetDemoData();
    const db = getSnapshot();
    const halfYearly = db.exams.find((e) => e.status === "verification")!;
    const sessions = db.marksEntrySessions.filter((s) => s.examId === halfYearly.id);
    expect(sessions.some((s) => s.status === "locked" || s.status === "draft")).toBe(true);
    expect(sessions.some((s) => s.status === "not-started")).toBe(true);
    expect(db.examResults.some((r) => r.examId === halfYearly.id)).toBe(false);
  });

  it("does not create exam subjects for the still-draft exam", () => {
    resetDemoData();
    const db = getSnapshot();
    const draftExam = db.exams.find((e) => e.status === "draft")!;
    expect(db.examSubjects.some((s) => s.examId === draftExam.id)).toBe(false);
  });

  it("publishes report cards only for the published exam's results", () => {
    resetDemoData();
    const db = getSnapshot();
    const publishedExam = db.exams.find((e) => e.status === "published")!;
    const reportCards = db.reportCards.filter((rc) => rc.examId === publishedExam.id);
    expect(reportCards.length).toBe(db.examResults.filter((r) => r.examId === publishedExam.id).length);
    expect(reportCards.every((rc) => rc.status === "published")).toBe(true);
  });
});
