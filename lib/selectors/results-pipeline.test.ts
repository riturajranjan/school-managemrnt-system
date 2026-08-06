import { describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { computeExamPipelineRow } from "./results-pipeline";

describe("computeExamPipelineRow", () => {
  it("marks the calculation stage complete and suggests publishing for a result-ready exam with report cards but no publication", () => {
    resetDemoData();
    const db = getSnapshot();
    const exam = db.exams.find((e) => db.examResults.some((r) => r.examId === e.id) && db.reportCards.some((rc) => rc.examId === e.id && rc.status !== "pending") && !db.resultPublications.some((p) => p.examId === e.id && p.status === "published"));
    if (!exam) return;
    const row = computeExamPipelineRow(db, exam, "Test Class");
    expect(row.stages.find((s) => s.key === "calculation")?.status).toBe("complete");
    expect(row.primaryAction.label).toBe("Publish");
  });

  it("suggests calculating results for an exam with completed marks and verification but no results yet", () => {
    resetDemoData();
    const db = getSnapshot();
    const exam = db.exams.find((e) => !db.examResults.some((r) => r.examId === e.id) && db.marksEntrySessions.filter((s) => s.examId === e.id).length > 0 && db.marksEntrySessions.filter((s) => s.examId === e.id).every((s) => s.completionPercent === 100));
    if (!exam) return;
    const row = computeExamPipelineRow(db, exam, "Test Class");
    expect(row.resultsCalculated).toBe(false);
    expect(row.primaryAction.label).toBe("Calculate results");
  });

  it("flags a published exam with zero results as inconsistent", () => {
    resetDemoData();
    const db = getSnapshot();
    const exam = db.exams.find((e) => e.status !== "published");
    if (!exam) return;
    const tampered = { ...db, exams: db.exams.map((e) => (e.id === exam.id ? { ...e, status: "published" as const } : e)), examResults: db.examResults.filter((r) => r.examId !== exam.id) };
    const row = computeExamPipelineRow(tampered, { ...exam, status: "published" }, "Test Class");
    expect(row.inconsistencies.some((i) => i.toLowerCase().includes("zero calculated results"))).toBe(true);
  });

  it("reports no inconsistencies for a clean, fully published exam", () => {
    resetDemoData();
    const db = getSnapshot();
    const exam = db.exams.find((e) => db.resultPublications.some((p) => p.examId === e.id && p.status === "published") && db.examResults.some((r) => r.examId === e.id));
    if (!exam) return;
    const row = computeExamPipelineRow(db, exam, "Test Class");
    expect(row.inconsistencies).toEqual([]);
  });
});
