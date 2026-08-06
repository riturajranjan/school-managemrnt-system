import { describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { computeReportCardReadiness } from "./report-card-readiness";

describe("computeReportCardReadiness", () => {
  it("reflects a fully-configured, published exam with no blocking issues", () => {
    resetDemoData();
    const db = getSnapshot();
    const readiness = computeReportCardReadiness(db);
    expect(readiness.templateConfigured).toBe(true);
    expect(readiness.calculatedResultCount).toBeGreaterThan(0);
    expect(readiness.eligibleExamCount).toBeGreaterThan(0);
    expect(readiness.eligibleStudentCount).toBeGreaterThan(0);
  });

  it("flags a missing template as a blocking issue", () => {
    resetDemoData();
    const db = getSnapshot();
    const noTemplateDb = { ...db, reportCardTemplates: [] };
    const readiness = computeReportCardReadiness(noTemplateDb);
    expect(readiness.templateConfigured).toBe(false);
    expect(readiness.blockingIssues.some((i) => i.includes("template"))).toBe(true);
  });

  it("flags no calculated results as a blocking issue", () => {
    resetDemoData();
    const db = getSnapshot();
    const noResultsDb = { ...db, examResults: [] };
    const readiness = computeReportCardReadiness(noResultsDb);
    expect(readiness.eligibleExamCount).toBe(0);
    expect(readiness.eligibleStudentCount).toBe(0);
    expect(readiness.blockingIssues.some((i) => i.toLowerCase().includes("result"))).toBe(true);
  });

  it("counts results whose student has no remark yet as missing remarks", () => {
    resetDemoData();
    const db = getSnapshot();
    const readiness = computeReportCardReadiness(db);
    const expectedMissing = db.examResults.filter((r) => !db.teacherRemarks.some((tr) => tr.examId === r.examId && tr.studentId === r.studentId)).length;
    expect(readiness.missingRemarksCount).toBe(expectedMissing);
  });
});
