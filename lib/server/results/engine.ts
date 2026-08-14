// Result computation engine (Phase 8C) — pure, deterministic functions. No DB
// access, no persistence; the caller (lib/server/results/service.ts) supplies
// real ExamScheduleEntry snapshots + real ExamMarkSheet/ExamMark rows and
// commits nothing until publication.
//
// V1 policy (documented here since none of it is derivable from existing real
// data — the old mock's grace-marks/attendance-eligibility/max-failed-subjects/
// min-overall-percent config has zero real backing and was NOT carried over):
//
//   Subject PASS  = sheet VERIFIED, mark MARKED, marksObtained >= passingMarks.
//   Subject FAIL  = sheet VERIFIED, mark MARKED, marksObtained <  passingMarks.
//   Subject ABSENT/EXEMPT = the explicit ExamMark status, never zero.
//   Subject INCOMPLETE = no sheet yet, sheet not VERIFIED, or (even on a
//     VERIFIED sheet) the student's own mark row is missing/PENDING — Phase 8B
//     allows submitting/verifying a sheet with some students still ungraded,
//     so this case is real and must not silently resolve to a result.
//
//   EXEMPT papers are excluded entirely from the overall percentage (both
//   numerator and denominator) — they never happened, for grading purposes.
//   ABSENT papers DO count toward the overall percentage: 0 obtained against
//   the paper's full maxMarks (missing an exam should cost you, unlike being
//   formally exempted from it).
//
//   Overall INCOMPLETE = any non-exempt paper is INCOMPLETE.
//   Overall ABSENT     = every non-exempt paper is ABSENT (nothing else to
//                        grade).
//   Overall FAIL       = at least one non-exempt paper is FAIL or ABSENT
//                        (mixed with others).
//   Overall PASS       = every non-exempt paper is PASS.
//   If a student has zero non-exempt papers at all, the result is INCOMPLETE
//   (there is nothing to grade — not a pass).
//
// Percentage is rounded to the nearest whole percent (Math.round) — marks
// throughout this codebase are plain Ints (Phase 8A/8B convention), so no
// decimal precision is introduced here either.
import type { ExamMarkStatus, ExamResultStatus, ExamSubjectResultDto } from "@/lib/api/contracts";

export type ScheduleEntryForResult = {
  id: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  maxMarks: number;
  passingMarks: number;
};

export type MarkForResult = {
  sheetStatus: "DRAFT" | "SUBMITTED" | "VERIFIED" | null; // null = no sheet exists for this entry yet
  markStatus: ExamMarkStatus | null; // null = no ExamMark row for this student
  theoryMarks: number | null;
  practicalMarks: number | null;
  marksObtained: number | null;
};

export type GradingBandLike = { label: string; minPercent: number; maxPercent: number };

/** Exactly one band should match a given percentage. Zero or multiple matches
 *  fail closed (returns null) rather than guessing — the caller decides
 *  whether that's a hard error (it is, at publish time). */
export function resolveGrade(percentage: number, bands: GradingBandLike[]): string | null {
  const matches = bands.filter((b) => percentage >= b.minPercent && percentage <= b.maxPercent);
  return matches.length === 1 ? matches[0].label : null;
}

export function computeSubjectResult(entry: ScheduleEntryForResult, mark: MarkForResult, bands: GradingBandLike[]): ExamSubjectResultDto {
  const base = { examScheduleEntryId: entry.id, subjectId: entry.subjectId, subjectName: entry.subjectName, subjectCode: entry.subjectCode, maxMarks: entry.maxMarks, passingMarks: entry.passingMarks };

  if (!mark.sheetStatus || mark.sheetStatus !== "VERIFIED") {
    return { ...base, markStatus: mark.sheetStatus ? "unverified" : "pending", theoryMarks: null, practicalMarks: null, marksObtained: null, percentage: null, grade: null, passStatus: "incomplete" };
  }
  if (!mark.markStatus || mark.markStatus === "pending") {
    return { ...base, markStatus: "pending", theoryMarks: null, practicalMarks: null, marksObtained: null, percentage: null, grade: null, passStatus: "incomplete" };
  }
  if (mark.markStatus === "exempt") {
    return { ...base, markStatus: "exempt", theoryMarks: null, practicalMarks: null, marksObtained: null, percentage: null, grade: null, passStatus: "exempt" };
  }
  if (mark.markStatus === "absent") {
    return { ...base, markStatus: "absent", theoryMarks: null, practicalMarks: null, marksObtained: null, percentage: null, grade: null, passStatus: "absent" };
  }
  // MARKED
  const marksObtained = mark.marksObtained ?? 0;
  const percentage = entry.maxMarks > 0 ? Math.round((marksObtained / entry.maxMarks) * 100) : 0;
  const grade = resolveGrade(percentage, bands);
  return {
    ...base, markStatus: "marked", theoryMarks: mark.theoryMarks, practicalMarks: mark.practicalMarks, marksObtained, percentage, grade,
    passStatus: marksObtained >= entry.passingMarks ? "pass" : "fail",
  };
}

export type OverallResult = { totalMaxMarks: number; totalMarksObtained: number; percentage: number | null; status: ExamResultStatus; grade: string | null };

export function computeOverallResult(subjects: ExamSubjectResultDto[], bands: GradingBandLike[]): OverallResult {
  const graded = subjects.filter((s) => s.passStatus !== "exempt");
  if (graded.length === 0 || graded.some((s) => s.passStatus === "incomplete")) {
    return { totalMaxMarks: 0, totalMarksObtained: 0, percentage: null, status: "incomplete", grade: null };
  }
  if (graded.every((s) => s.passStatus === "absent")) {
    return { totalMaxMarks: 0, totalMarksObtained: 0, percentage: null, status: "absent", grade: null };
  }
  const totalMaxMarks = graded.reduce((sum, s) => sum + s.maxMarks, 0);
  const totalMarksObtained = graded.reduce((sum, s) => sum + (s.marksObtained ?? 0), 0);
  const percentage = totalMaxMarks > 0 ? Math.round((totalMarksObtained / totalMaxMarks) * 100) : 0;
  const status: ExamResultStatus = graded.some((s) => s.passStatus === "fail" || s.passStatus === "absent") ? "fail" : "pass";
  const grade = resolveGrade(percentage, bands);
  return { totalMaxMarks, totalMarksObtained, percentage, status, grade };
}

// ── Grading band validation (shared by create + reconcile) ──────────────────

export type BandInput = { label: string; minPercent: number; maxPercent: number; isPass: boolean; order: number };

/** Mirrors the mock's validateGradeRanges (lib/services/result-engine.ts) —
 *  same overlap/range-order logic, reimplemented server-side as the real
 *  authority. Returns one message per problem; empty = valid. */
export function validateGradingBands(bands: BandInput[]): string[] {
  const errors: string[] = [];
  if (bands.length === 0) errors.push("Add at least one grade band.");
  for (const b of bands) {
    if (b.minPercent < 0 || b.maxPercent > 100) errors.push(`"${b.label}": percentages must be within 0-100.`);
    if (b.minPercent > b.maxPercent) errors.push(`"${b.label}": minimum (${b.minPercent}) is above maximum (${b.maxPercent}).`);
  }
  const sorted = [...bands].sort((a, b) => a.minPercent - b.minPercent);
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1];
    if (a.maxPercent >= b.minPercent) errors.push(`"${a.label}" (${a.minPercent}-${a.maxPercent}) overlaps "${b.label}" (${b.minPercent}-${b.maxPercent}).`);
  }
  return errors;
}
