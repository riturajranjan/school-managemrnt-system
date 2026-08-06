import type { ID } from "./common";

export type GradingSystem = "percentage" | "letter" | "gpa" | "cgpa" | "marks-based" | "skill" | "competency" | "pass-fail" | "descriptive" | "custom";

export const gradingSystemLabels: Record<GradingSystem, string> = {
  percentage: "Percentage",
  letter: "Letter grades",
  gpa: "GPA",
  cgpa: "CGPA",
  "marks-based": "Marks-based",
  skill: "Skill grades",
  competency: "Competency levels",
  "pass-fail": "Pass / fail",
  descriptive: "Descriptive assessment",
  custom: "Custom",
};

/** One band of a grading scheme, e.g. "A1" 91-100 or "Outstanding" 91-100. Ranges are
 * validated for non-overlap by the grading service, never trusted from the UI alone. */
export type GradeRange = {
  id: ID;
  name: string;
  minPercent: number;
  maxPercent: number;
  gradePoint?: number;
  description?: string;
  color: string;
  isPass: boolean;
  order: number;
};

export type GradingSchemeStatus = "active" | "draft" | "archived";

export type GradingScheme = {
  id: ID;
  name: string;
  system: GradingSystem;
  session: string;
  /** Empty = applies to every class. */
  applicableClassIds: ID[];
  /** Empty = applies to every subject. */
  applicableSubjectIds: ID[];
  status: GradingSchemeStatus;
  ranges: GradeRange[];
  createdAt: string;
  updatedAt: string;
};

export type RoundingRule = "nearest" | "up" | "down" | "none";

export const roundingRuleLabels: Record<RoundingRule, string> = {
  nearest: "Round to nearest",
  up: "Round up",
  down: "Round down",
  none: "No rounding",
};

export type TieBreaker = "higher-theory" | "higher-practical" | "alphabetical" | "none";

export const tieBreakerLabels: Record<TieBreaker, string> = {
  "higher-theory": "Higher theory marks",
  "higher-practical": "Higher practical marks",
  alphabetical: "Alphabetical by name",
  none: "No tie-break (share rank)",
};

export type RankInclusionRule = "all" | "pass-only" | "exclude-optional";

export const rankInclusionLabels: Record<RankInclusionRule, string> = {
  all: "All students",
  "pass-only": "Passing students only",
  "exclude-optional": "Exclude optional subjects",
};

/** Configurable pass/fail, grace-mark and rank rules applied by the result engine — kept
 * separate from GradingScheme so the same grade bands can be reused under different
 * pass thresholds (e.g. board exam vs internal assessment). */
export type ResultRule = {
  id: ID;
  name: string;
  gradingSchemeId: ID;
  minMarksPerSubjectPercent?: number;
  minTheoryPercent?: number;
  minPracticalPercent?: number;
  minOverallPercent?: number;
  maxFailedSubjects: number;
  graceMarksLimit: number;
  /** Minimum exam-attendance percent required to be result-eligible; undefined = no attendance gate. */
  attendanceEligibilityPercent?: number;
  rankInclusion: RankInclusionRule;
  bestOfEnabled: boolean;
  bestOfCount?: number;
  roundingRule: RoundingRule;
  decimalPrecision: number;
  tieBreaker: TieBreaker;
  createdAt: string;
  updatedAt: string;
};
