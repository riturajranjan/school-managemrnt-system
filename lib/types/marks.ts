import type { ID } from "./common";

export type MarksComponentKey = "theory" | "practical" | "internal" | "project";

export const marksComponentLabels: Record<MarksComponentKey, string> = {
  theory: "Theory",
  practical: "Practical",
  internal: "Internal",
  project: "Project",
};

/** One student's marks for one exam subject. Attendance lives on ExamAttendanceRecord
 * (joined by examSubjectId + studentId), not duplicated here — marks entry reads it to
 * gate the row, but the two are independently owned so attendance can be marked before
 * marks entry opens. */
export type StudentMark = {
  id: ID;
  examId: ID;
  examSubjectId: ID;
  studentId: ID;
  theory?: number;
  practical?: number;
  internal?: number;
  project?: number;
  graceApplied: number;
  /** Cached at save time from the entered components; the result engine recomputes independently. */
  total?: number;
  remark?: string;
  enteredBy?: string;
  enteredAt?: string;
};

export type MarksEntryStatus = "not-started" | "draft" | "submitted" | "locked";

export const marksEntryStatusLabels: Record<MarksEntryStatus, string> = {
  "not-started": "Not started",
  draft: "Draft",
  submitted: "Submitted",
  locked: "Locked",
};

/** Tracks entry progress/lock state for one exam-subject's whole class list — the unit a teacher submits. */
export type MarksEntrySession = {
  id: ID;
  examId: ID;
  examSubjectId: ID;
  status: MarksEntryStatus;
  completionPercent: number;
  lastSavedAt?: string;
  lastSavedBy?: string;
  submittedAt?: string;
  submittedBy?: string;
  lockedAt?: string;
  lockedBy?: string;
  reopenedAt?: string;
  reopenedBy?: string;
  reopenReason?: string;
};

export type MarksVerificationStage = "subject-teacher" | "class-teacher" | "hod" | "exam-controller" | "principal";

export const marksVerificationStageLabels: Record<MarksVerificationStage, string> = {
  "subject-teacher": "Subject teacher",
  "class-teacher": "Class teacher",
  hod: "Head of department",
  "exam-controller": "Examination controller",
  principal: "Principal",
};

export type MarksVerificationStatus = "not-started" | "draft" | "submitted" | "under-review" | "changes-requested" | "verified" | "approved" | "locked";

export const marksVerificationStatusLabels: Record<MarksVerificationStatus, string> = {
  "not-started": "Not started",
  draft: "Draft",
  submitted: "Submitted",
  "under-review": "Under review",
  "changes-requested": "Changes requested",
  verified: "Verified",
  approved: "Approved",
  locked: "Locked",
};

export type MarksVerificationActionType = "submit" | "verify" | "approve" | "request-changes" | "reopen" | "lock";

export type MarksVerificationAction = {
  id: ID;
  stage: MarksVerificationStage;
  action: MarksVerificationActionType;
  actorName: string;
  actorRole: string;
  comment?: string;
  createdAt: string;
};

export type MarksVerification = {
  id: ID;
  examId: ID;
  examSubjectId: ID;
  status: MarksVerificationStatus;
  currentStage: MarksVerificationStage;
  history: MarksVerificationAction[];
};
