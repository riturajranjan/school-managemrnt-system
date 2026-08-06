import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { calculateResults, checkResultCalculationConfig } from "./result-processing-service";

const ACTOR = { name: "Examination Controller", role: "Examination Controller" };

describe("result-processing-service", () => {
  beforeEach(() => {
    resetDemoData();
  });

  it("reports no config errors for the fully-configured published exam", () => {
    const db = getSnapshot();
    const publishedExam = db.exams.find((e) => e.status === "published");
    if (!publishedExam) return;
    expect(checkResultCalculationConfig(db, publishedExam.id)).toHaveLength(0);
  });

  it("reports missing marks for an exam still mid-entry", () => {
    const db = getSnapshot();
    const halfYearly = db.exams.find((e) => e.status === "verification");
    if (!halfYearly) return;
    const errors = checkResultCalculationConfig(db, halfYearly.id);
    expect(errors.some((e) => e.message.includes("missing marks"))).toBe(true);
  });

  it("recalculating bumps the calculation version and archives the previous result", () => {
    const db = getSnapshot();
    const publishedExam = db.exams.find((e) => e.status === "published");
    if (!publishedExam) return;
    const before = getSnapshot().examResults.filter((r) => r.examId === publishedExam.id);
    if (before.length === 0) return;
    const firstVersion = before[0].calculationVersion;

    const result = calculateResults(publishedExam.id, ACTOR);
    expect(result.ok).toBe(true);

    const after = getSnapshot().examResults.filter((r) => r.examId === publishedExam.id);
    expect(after[0].calculationVersion).toBe(firstVersion + 1);
    const versions = getSnapshot().resultVersions.filter((v) => v.examId === publishedExam.id && v.version === firstVersion);
    expect(versions.length).toBeGreaterThan(0);
  });

  it("refuses to calculate for an exam with no grading scheme assigned", () => {
    const db = getSnapshot();
    const draftLikeExam = db.exams.find((e) => !e.gradingSchemeId);
    if (!draftLikeExam) return;
    const result = calculateResults(draftLikeExam.id, ACTOR);
    expect(result.ok).toBe(false);
  });
});
