import type { ID, StatusTone } from "./common";

export type Teacher = {
  id: ID;
  name: string;
  email: string;
  phone: string;
  photoUrl?: string;
  employeeId: string;
  department: string;
  subjectIds: ID[];
  homeroomSectionId?: ID;
  joinDate: string;
  status: "active" | "on-leave" | "inactive";
  maxWeeklyPeriods: number;
};

// Store-backed, mutable class/section model for Phase 3 class management.
// Seeded as a snapshot of lib/data/seed/reference.ts's schoolClasses (the
// read-only source Phase 2 pages already depend on) so IDs line up exactly
// with every subject/timetable/attendance record — see academics-service.ts
// for why the two collections are kept separate instead of unified.
export type ClassStatus = "active" | "archived";

export type ManagedSection = {
  id: ID;
  classId: ID;
  name: string;
  capacity: number;
  enrolledCount: number;
  classTeacherId?: ID;
  assistantTeacherId?: ID;
  roomId?: ID;
  shift: "morning" | "afternoon";
};

export type ManagedClass = {
  id: ID;
  name: string;
  order: number;
  status: ClassStatus;
  sections: ManagedSection[];
};

export type Room = {
  id: ID;
  name: string;
  type: "classroom" | "lab" | "hall" | "sports";
  capacity: number;
};

export type SubjectType = "core" | "elective" | "optional" | "practical" | "language" | "co-curricular";

export type Subject = {
  id: ID;
  name: string;
  code: string;
  shortName: string;
  department: string;
  type: SubjectType;
  gradeRangeStart: number;
  gradeRangeEnd: number;
  credit: number;
  passingMarks: number;
  maxMarks: number;
  theoryMarks: number;
  practicalMarks: number;
  color: string;
  status: "active" | "inactive";
};

export type SubjectAssignment = {
  id: ID;
  subjectId: ID;
  classId: ID;
  sectionId: ID;
  primaryTeacherId: ID;
  secondaryTeacherId?: ID;
  weeklyPeriods: number;
  roomId?: ID;
  session: string;
};

export type ProgressStatus = "not-started" | "planned" | "in-progress" | "completed" | "delayed" | "skipped" | "needs-review";

export const progressStatusLabels: Record<ProgressStatus, string> = {
  "not-started": "Not started",
  planned: "Planned",
  "in-progress": "In progress",
  completed: "Completed",
  delayed: "Delayed",
  skipped: "Skipped",
  "needs-review": "Needs review",
};

export const progressStatusTone: Record<ProgressStatus, StatusTone> = {
  "not-started": "neutral",
  planned: "info",
  "in-progress": "info",
  completed: "success",
  delayed: "error",
  skipped: "neutral",
  "needs-review": "warning",
};

export type CurriculumTopic = {
  id: ID;
  chapterId: ID;
  title: string;
  sequence: number;
  status: ProgressStatus;
  learningOutcomes: string[];
};

export type CurriculumChapter = {
  id: ID;
  unitId: ID;
  title: string;
  sequence: number;
  status: ProgressStatus;
  plannedStart?: string;
  plannedEnd?: string;
  actualCompletion?: string;
  topics: CurriculumTopic[];
};

export type CurriculumUnit = {
  id: ID;
  subjectId: ID;
  classId: ID;
  session: string;
  title: string;
  description: string;
  sequence: number;
  plannedStart: string;
  plannedEnd: string;
  actualCompletion?: string;
  teacherId: ID;
  status: ProgressStatus;
  estimatedPeriods: number;
  completedPeriods: number;
  chapters: CurriculumChapter[];
};

export type LessonPlanStatus = "draft" | "submitted" | "approved" | "rejected" | "scheduled" | "completed" | "missed" | "rescheduled";

export const lessonPlanStatusTone: Record<LessonPlanStatus, StatusTone> = {
  draft: "neutral",
  submitted: "info",
  approved: "success",
  rejected: "error",
  scheduled: "info",
  completed: "success",
  missed: "error",
  rescheduled: "warning",
};

export type LessonPlanResource = { id: ID; name: string; kind: "link" | "file" };

export type LessonPlan = {
  id: ID;
  teacherId: ID;
  classId: ID;
  sectionId: ID;
  subjectId: ID;
  unitId?: ID;
  chapterId?: ID;
  date: string;
  period: number;
  learningObjective: string;
  teachingMethod: string;
  materials: string;
  activity: string;
  homework?: string;
  assessmentMethod?: string;
  differentiationPlan?: string;
  notes?: string;
  attachments: LessonPlanResource[];
  status: LessonPlanStatus;
  reviewComment?: string;
  reviewedBy?: string;
  createdAt: string;
  updatedAt: string;
};

export type SubmissionType = "offline" | "text" | "file" | "image" | "link" | "quiz" | "mixed";

export type HomeworkStatus = "draft" | "scheduled" | "published" | "due-soon" | "overdue" | "closed" | "evaluated" | "archived";

export const homeworkStatusTone: Record<HomeworkStatus, StatusTone> = {
  draft: "neutral",
  scheduled: "info",
  published: "info",
  "due-soon": "warning",
  overdue: "error",
  closed: "neutral",
  evaluated: "success",
  archived: "neutral",
};

export type Homework = {
  id: ID;
  title: string;
  description: string;
  classId: ID;
  sectionId: ID;
  subjectId: ID;
  teacherId: ID;
  assignedDate: string;
  dueDate: string;
  maxMarks: number;
  instructions: string;
  submissionType: SubmissionType;
  allowLateSubmission: boolean;
  requireParentAcknowledgement: boolean;
  visibility: "class" | "section" | "individual";
  status: HomeworkStatus;
  createdAt: string;
  updatedAt: string;
};

export type SubmissionStatus = "not-submitted" | "submitted" | "late" | "needs-resubmission" | "evaluated";

export const submissionStatusTone: Record<SubmissionStatus, StatusTone> = {
  "not-submitted": "neutral",
  submitted: "info",
  late: "warning",
  "needs-resubmission": "error",
  evaluated: "success",
};

export type HomeworkSubmission = {
  id: ID;
  homeworkId: ID;
  studentId: ID;
  submittedAt?: string;
  content?: string;
  fileNames: string[];
  status: SubmissionStatus;
  marksObtained?: number;
  feedback?: string;
  acknowledgedByParent: boolean;
};

export type AcademicEventType = "holiday" | "exam" | "ptm" | "event" | "deadline" | "admissions" | "training" | "sports" | "activity" | "custom";

export const academicEventTypeTone: Record<AcademicEventType, StatusTone> = {
  holiday: "success",
  exam: "error",
  ptm: "info",
  event: "info",
  deadline: "warning",
  admissions: "info",
  training: "neutral",
  sports: "success",
  activity: "neutral",
  custom: "neutral",
};

export type AcademicEvent = {
  id: ID;
  title: string;
  type: AcademicEventType;
  startDate: string;
  endDate?: string;
  allDay: boolean;
  audience: ("all" | "teachers" | "students" | "parents" | "staff")[];
  description?: string;
  recurring?: "none" | "weekly" | "yearly";
  createdBy: string;
};

export type StudentSupportAlertType = "attendance" | "performance" | "homework" | "behaviour" | "wellbeing";

export type StudentSupportAlert = {
  id: ID;
  studentId: ID;
  type: StudentSupportAlertType;
  severity: "high" | "medium" | "low";
  detail: string;
  createdAt: string;
  resolved: boolean;
};
