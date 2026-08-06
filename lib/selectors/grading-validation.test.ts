import { describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { computeClassesWithoutScheme, detectSchemeIssues, schemeUsageCount } from "./grading-validation";
import type { GradeRange } from "@/lib/types/grading";

function range(partial: Partial<GradeRange> & Pick<GradeRange, "id" | "minPercent" | "maxPercent">): GradeRange {
  return { name: partial.id, color: "#000", isPass: true, order: 1, ...partial };
}

describe("detectSchemeIssues", () => {
  it("returns no issues for a clean, fully-covered scheme", () => {
    const ranges = [
      range({ id: "1", minPercent: 0, maxPercent: 32, isPass: false }),
      range({ id: "2", minPercent: 33, maxPercent: 100, isPass: true }),
    ];
    expect(detectSchemeIssues(ranges)).toEqual([]);
  });

  it("flags a gap in coverage", () => {
    const ranges = [range({ id: "1", minPercent: 0, maxPercent: 50 }), range({ id: "2", minPercent: 60, maxPercent: 100 })];
    const issues = detectSchemeIssues(ranges);
    expect(issues.some((i) => i.type === "gap")).toBe(true);
  });

  it("flags overlapping ranges", () => {
    const ranges = [range({ id: "1", minPercent: 0, maxPercent: 60 }), range({ id: "2", minPercent: 50, maxPercent: 100 })];
    const issues = detectSchemeIssues(ranges);
    expect(issues.some((i) => i.type === "overlap")).toBe(true);
  });

  it("flags a failing band that reaches above a passing band's floor", () => {
    const ranges = [range({ id: "1", minPercent: 0, maxPercent: 40, isPass: false }), range({ id: "2", minPercent: 35, maxPercent: 100, isPass: true })];
    const issues = detectSchemeIssues(ranges);
    expect(issues.some((i) => i.type === "pass-fail" || i.type === "overlap")).toBe(true);
  });

  it("returns no issues for an empty range list", () => {
    expect(detectSchemeIssues([])).toEqual([]);
  });
});

describe("computeClassesWithoutScheme", () => {
  it("returns no gaps when a blanket active scheme exists", () => {
    resetDemoData();
    const db = getSnapshot();
    const hasBlanket = db.gradingSchemes.some((s) => s.status === "active" && s.applicableClassIds.length === 0);
    if (!hasBlanket) return;
    expect(computeClassesWithoutScheme(db)).toEqual([]);
  });
});

describe("schemeUsageCount", () => {
  it("counts exams referencing the scheme", () => {
    resetDemoData();
    const db = getSnapshot();
    const scheme = db.gradingSchemes.find((s) => db.exams.some((e) => e.gradingSchemeId === s.id));
    if (!scheme) return;
    const expected = db.exams.filter((e) => e.gradingSchemeId === scheme.id).length;
    expect(schemeUsageCount(db, scheme)).toBe(expected);
  });
});
