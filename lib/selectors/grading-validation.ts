import type { Db } from "@/lib/data/store";
import type { GradeRange, GradingScheme } from "@/lib/types/grading";
import { validateGradeRanges } from "@/lib/services/result-engine";

export type GradingSchemeIssue = { type: "overlap" | "gap" | "boundary" | "pass-fail"; message: string };

/** Beyond the overlap/min-max checks already enforced at save time, this also flags
 * uncovered percentage gaps and a passing band whose floor sits below a failing band's
 * ceiling — both are legal to save individually but produce nonsensical grading. */
export function detectSchemeIssues(ranges: GradeRange[]): GradingSchemeIssue[] {
  const issues: GradingSchemeIssue[] = [];
  if (ranges.length === 0) return issues;

  for (const message of validateGradeRanges(ranges)) {
    issues.push({ type: message.includes("overlaps") ? "overlap" : "boundary", message });
  }

  // Whole-number bands (81-90, 91-100) are contiguous even though minPercent jumps by
  // more than maxPercent — there's no real value between 90 and 91. Only a gap of more
  // than one point is treated as an actual hole in coverage.
  const sorted = [...ranges].sort((a, b) => a.minPercent - b.minPercent);
  if (sorted[0].minPercent > 1) {
    issues.push({ type: "gap", message: `0%–${sorted[0].minPercent}% isn't covered by any grade.` });
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    if (next.minPercent - current.maxPercent > 1) {
      issues.push({ type: "gap", message: `${current.maxPercent}%–${next.minPercent}% isn't covered by any grade.` });
    }
  }
  const last = sorted[sorted.length - 1];
  if (last.maxPercent < 99) {
    issues.push({ type: "gap", message: `${last.maxPercent}%–100% isn't covered by any grade.` });
  }

  const passing = sorted.filter((r) => r.isPass);
  const failing = sorted.filter((r) => !r.isPass);
  if (passing.length > 0 && failing.length > 0) {
    const lowestPassMin = Math.min(...passing.map((r) => r.minPercent));
    const highestFailMax = Math.max(...failing.map((r) => r.maxPercent));
    if (lowestPassMin < highestFailMax) {
      issues.push({ type: "pass-fail", message: `A failing band reaches ${highestFailMax}%, above the lowest passing band's ${lowestPassMin}% floor.` });
    }
  }

  return issues;
}

export type ClassWithoutScheme = { classId: string; className: string };

/** A class is covered if any active scheme is either blanket (empty applicableClassIds)
 * or explicitly lists it. */
export function computeClassesWithoutScheme(db: Db): ClassWithoutScheme[] {
  const activeSchemes = db.gradingSchemes.filter((s) => s.status === "active");
  if (activeSchemes.some((s) => s.applicableClassIds.length === 0)) return [];
  return db.classes.filter((c) => !activeSchemes.some((s) => s.applicableClassIds.includes(c.id))).map((c) => ({ classId: c.id, className: c.name }));
}

export function schemeUsageCount(db: Db, scheme: GradingScheme): number {
  return db.exams.filter((e) => e.gradingSchemeId === scheme.id).length;
}
