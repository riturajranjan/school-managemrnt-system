import type { ID, StatusTone } from "./common";

export type ExamType =
  | "unit-test"
  | "weekly-test"
  | "monthly-test"
  | "midterm"
  | "half-yearly"
  | "annual"
  | "pre-board"
  | "board"
  | "practical"
  | "oral"
  | "assignment"
  | "project"
  | "internal-assessment"
  | "custom";

export const examTypeLabels: Record<ExamType, string> = {
  "unit-test": "Unit test",
  "weekly-test": "Weekly test",
  "monthly-test": "Monthly test",
  midterm: "Midterm",
  "half-yearly": "Half-yearly",
  annual: "Annual",
  "pre-board": "Pre-board",
  board: "Board examination",
  practical: "Practical",
  oral: "Oral",
  assignment: "Assignment",
  project: "Project",
  "internal-assessment": "Internal assessment",
  custom: "Custom",
};

export type ExamStatus =
  | "draft"
  | "scheduled"
  | "in-progress"
  | "marks-entry"
  | "verification"
  | "result-processing"
  | "result-ready"
  | "published"
  | "archived"
  | "cancelled";

export const examStatusLabels: Record<ExamStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  "in-progress": "In progress",
  "marks-entry": "Marks entry",
  verification: "Verification",
  "result-processing": "Result processing",
  "result-ready": "Result ready",
  published: "Published",
  archived: "Archived",
  cancelled: "Cancelled",
};

export const examStatusTone: Record<ExamStatus, StatusTone> = {
  draft: "neutral",
  scheduled: "info",
  "in-progress": "info",
  "marks-entry": "warning",
  verification: "warning",
  "result-processing": "info",
  "result-ready": "success",
  published: "success",
  archived: "neutral",
  cancelled: "error",
};

export type SupplementaryReason = "re-test" | "supplementary" | "improvement" | "medical" | "missed" | "grace-review";

export const supplementaryReasonLabels: Record<SupplementaryReason, string> = {
  "re-test": "Re-test",
  supplementary: "Supplementary exam",
  improvement: "Improvement exam",
  medical: "Medical re-exam",
  missed: "Missed exam",
  "grace-review": "Grace review",
};

// ExamSchedule and ExamRoom/ExamInvigilator are deliberately not separate tables:
// scheduling data (date/time/room/invigilator) lives directly on ExamSubject (the
// thing actually being scheduled), and Room/Teacher are reused as-is from
// lib/types/academics.ts — a parallel schedule table would just duplicate those
// fields and risk drifting out of sync, which the timetable module's normalized
// join-in-selector convention specifically avoids.
export type Exam = {
  id: ID;
  name: string;
  code: string;
  type: ExamType;
  session: string;
  branchId: string;
  term: string;
  description?: string;
  startDate: string;
  endDate: string;
  resultDate?: string;
  status: ExamStatus;
  scope: "internal" | "external";
  mode: "online" | "offline";
  classIds: ID[];
  gradingSchemeId?: ID;
  resultRuleId?: ID;
  reportCardTemplateId?: ID;
  /** Set when this exam is a re-test/supplementary/improvement exam linked back to an original. */
  parentExamId?: ID;
  supplementaryReason?: SupplementaryReason;
  notifyOnPublish: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

/** Per class+section participation in an exam — lets a class opt out, or a section exclude specific students (e.g. transferred out) without touching the section's roster. */
export type ExamClass = {
  id: ID;
  examId: ID;
  classId: ID;
  sectionId: ID;
  excludedStudentIds: ID[];
  note?: string;
};

export type ExamSubject = {
  id: ID;
  examId: ID;
  classId: ID;
  sectionId: ID;
  subjectId: ID;
  date?: string;
  startTime?: string;
  endTime?: string;
  maxMarks: number;
  passingMarks: number;
  theoryMarks: number;
  practicalMarks: number;
  internalMarks: number;
  projectMarks: number;
  graceMarksLimit: number;
  /** Percent weight this subject carries toward the overall result; defaults to an even split across the exam's subjects. */
  weightage: number;
  roomId?: ID;
  examinerId?: ID;
  invigilatorId?: ID;
  markEntryTeacherId?: ID;
  verificationTeacherId?: ID;
  instructions?: string;
  locked: boolean;
};

export type ExamConflictType =
  | "student-overlap"
  | "teacher-overlap"
  | "invigilator-overlap"
  | "room-overlap"
  | "room-capacity"
  | "insufficient-gap"
  | "outside-school-hours"
  | "holiday-conflict"
  | "locked-slot";

export const examConflictLabels: Record<ExamConflictType, string> = {
  "student-overlap": "Student schedule overlap",
  "teacher-overlap": "Teacher overlap",
  "invigilator-overlap": "Invigilator overlap",
  "room-overlap": "Room overlap",
  "room-capacity": "Room capacity exceeded",
  "insufficient-gap": "Insufficient gap between exams",
  "outside-school-hours": "Outside school hours",
  "holiday-conflict": "Falls on a holiday",
  "locked-slot": "Locked slot conflict",
};

export type ExamConflict = {
  id: ID;
  type: ExamConflictType;
  description: string;
  examSubjectIds: ID[];
  severity: "error" | "warning";
};

/** A conflict a user has explicitly reviewed and chosen to keep as-is. */
export type DismissedExamConflict = {
  id: ID;
  conflictId: ID;
  reason: string;
  dismissedBy: string;
  dismissedAt: string;
};

export type ExamAttendanceStatus = "present" | "absent" | "late" | "medical" | "exempted" | "malpractice" | "withheld" | "not-marked";

export const examAttendanceStatusLabels: Record<ExamAttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  medical: "Medical exemption",
  exempted: "Exempted",
  malpractice: "Malpractice",
  withheld: "Withheld",
  "not-marked": "Not marked",
};

export const examAttendanceStatusTone: Record<ExamAttendanceStatus, StatusTone> = {
  present: "success",
  absent: "error",
  late: "warning",
  medical: "info",
  exempted: "neutral",
  malpractice: "error",
  withheld: "error",
  "not-marked": "neutral",
};

export type ExamAttendanceRecord = {
  id: ID;
  examId: ID;
  examSubjectId: ID;
  studentId: ID;
  status: ExamAttendanceStatus;
  note?: string;
  documentName?: string;
  markedBy?: string;
  markedAt?: string;
  locked: boolean;
};

export type ExamAuditAction =
  | "exam-created"
  | "schedule-changed"
  | "marks-entered"
  | "marks-imported"
  | "marks-modified"
  | "verification-requested"
  | "marks-approved"
  | "result-calculated"
  | "result-recalculated"
  | "report-card-generated"
  | "result-published"
  | "publication-revoked"
  | "student-promoted"
  | "manual-override-used";

export const examAuditActionLabels: Record<ExamAuditAction, string> = {
  "exam-created": "Exam created",
  "schedule-changed": "Schedule changed",
  "marks-entered": "Marks entered",
  "marks-imported": "Marks imported",
  "marks-modified": "Marks modified",
  "verification-requested": "Verification requested",
  "marks-approved": "Marks approved",
  "result-calculated": "Result calculated",
  "result-recalculated": "Result recalculated",
  "report-card-generated": "Report card generated",
  "result-published": "Result published",
  "publication-revoked": "Publication revoked",
  "student-promoted": "Student promoted",
  "manual-override-used": "Manual override used",
};

export type ExamAuditEntry = {
  id: ID;
  examId?: ID;
  action: ExamAuditAction;
  actorName: string;
  actorRole: string;
  summary: string;
  previousValue?: string;
  newValue?: string;
  reason?: string;
  createdAt: string;
};
