import type { ID } from "./common";

export type SubjectResultStatus = "pass" | "fail" | "absent" | "exempted" | "withheld";

export type SubjectResult = {
  examSubjectId: ID;
  subjectId: ID;
  theory?: number;
  practical?: number;
  internal?: number;
  project?: number;
  graceApplied: number;
  total: number;
  maxMarks: number;
  percent: number;
  grade: string;
  gradePoint?: number;
  status: SubjectResultStatus;
  teacherRemark?: string;
};

export type OverallResultStatus = "pass" | "fail" | "withheld" | "absent" | "re-exam-required" | "pending";

export const overallResultStatusLabels: Record<OverallResultStatus, string> = {
  pass: "Pass",
  fail: "Fail",
  withheld: "Withheld",
  absent: "Absent",
  "re-exam-required": "Re-exam required",
  pending: "Pending",
};

export type ResultDivision = "distinction" | "first" | "second" | "third" | "none";

/** The current (latest) calculated result for one student in one exam. Recalculation
 * updates this row in place after archiving the previous state into ResultVersion —
 * so this table always answers "what's true right now" without a join. */
export type StudentResult = {
  id: ID;
  examId: ID;
  studentId: ID;
  classId: ID;
  sectionId: ID;
  subjectResults: SubjectResult[];
  totalObtained: number;
  totalMax: number;
  percent: number;
  weightedPercent?: number;
  grade: string;
  gpa?: number;
  cgpa?: number;
  division?: ResultDivision;
  status: OverallResultStatus;
  failedSubjectCount: number;
  rank?: number;
  attendancePercent: number;
  eligibleForRank: boolean;
  calculationVersion: number;
  calculatedAt: string;
  appliedRuleId: ID;
  /** Human-readable trace of what the engine did, e.g. "Grace marks applied: +2 Mathematics theory (limit 5)" — surfaced in the result-processing drawer for transparency, never hidden in a black-box calculation. */
  explanation: string[];
};

/** Immutable snapshot archived every time a StudentResult is recalculated or revised
 * (e.g. a supplementary exam), so historical results are never silently overwritten. */
export type ResultVersion = {
  id: ID;
  examId: ID;
  studentId: ID;
  version: number;
  snapshot: StudentResult;
  reason: string;
  createdBy: string;
  createdAt: string;
};

export type ResultPublicationScope = "all" | "class" | "section" | "selected-students";

export type ResultPublicationStatus = "scheduled" | "published" | "revoked";

export type ResultPublicationChannel = "parent-portal" | "student-portal" | "email" | "push" | "sms";

export type ResultPublication = {
  id: ID;
  examId: ID;
  scope: ResultPublicationScope;
  classId?: ID;
  sectionId?: ID;
  studentIds?: ID[];
  status: ResultPublicationStatus;
  /** Undefined + status "published" means it went out immediately. */
  publishAt?: string;
  channels: ResultPublicationChannel[];
  publishedBy?: string;
  publishedAt?: string;
  revokedBy?: string;
  revokedAt?: string;
  revokeReason?: string;
};
