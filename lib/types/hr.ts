import type { ID } from "./common";
import type { Money } from "@/lib/finance/money";

// ===========================================================================
// Phase 8 — HR & People Operations. Frontend mock models only (no DB schema).
// ===========================================================================

// ---------------------------------------------------------------------------
// Departments & designations
// ---------------------------------------------------------------------------

export type Department = {
  id: ID;
  name: string;
  code: string;
  headEmployeeId?: ID;
  colorTone: "info" | "success" | "warning" | "neutral" | "error";
  parentId?: ID;
  branch: string;
  budgetNote?: string;
  createdAt: string;
};

export type EmploymentType = "permanent" | "fixed-term" | "probation" | "temporary" | "part-time" | "consultant" | "visiting-faculty";

export const employmentTypeLabels: Record<EmploymentType, string> = {
  permanent: "Permanent",
  "fixed-term": "Fixed term",
  probation: "Probation",
  temporary: "Temporary",
  "part-time": "Part time",
  consultant: "Consultant",
  "visiting-faculty": "Visiting faculty",
};

export type Designation = {
  id: ID;
  title: string;
  code: string;
  departmentId: ID;
  level: number;
  reportsToDesignationId?: ID;
  defaultEmploymentType: EmploymentType;
  status: "active" | "inactive";
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Employee
// ---------------------------------------------------------------------------

export type EmployeeStatus = "active" | "probation" | "on-leave" | "notice-period" | "suspended" | "inactive" | "resigned" | "retired";

export const employeeStatusLabels: Record<EmployeeStatus, string> = {
  active: "Active",
  probation: "Probation",
  "on-leave": "On leave",
  "notice-period": "Notice period",
  suspended: "Suspended",
  inactive: "Inactive",
  resigned: "Resigned",
  retired: "Retired",
};

export const employeeStatusTone: Record<EmployeeStatus, "success" | "warning" | "error" | "info" | "neutral"> = {
  active: "success",
  probation: "info",
  "on-leave": "info",
  "notice-period": "warning",
  suspended: "error",
  inactive: "neutral",
  resigned: "neutral",
  retired: "neutral",
};

export type EmployeeStage = "candidate" | "joined" | "probation" | "confirmed" | "growth" | "promotion" | "transfer" | "exit";

export const employeeStageLabels: Record<EmployeeStage, string> = {
  candidate: "Candidate",
  joined: "Joined",
  probation: "Probation",
  confirmed: "Confirmed",
  growth: "Growth",
  promotion: "Promotion",
  transfer: "Transfer",
  exit: "Exit",
};

export type EmergencyContact = { name: string; relationship: string; phone: string };
export type Qualification = { degree: string; institution: string; year: number };
export type WorkExperience = { organization: string; role: string; fromYear: number; toYear: number };

export type Employee = {
  id: ID;
  employeeCode: string;
  firstName: string;
  lastName: string;
  photoColor: string;
  gender: "male" | "female" | "other";
  dob: string;
  email: string;
  phone: string;
  address: string;
  departmentId: ID;
  designationId: ID;
  branch: string;
  employmentType: EmploymentType;
  status: EmployeeStatus;
  stage: EmployeeStage;
  joiningDate: string;
  confirmationDate?: string;
  reportingManagerId?: ID;
  /** Linked academic teacher record when this employee is teaching staff. */
  teacherId?: ID;
  isTeaching: boolean;
  /** Monthly gross — display only; real payroll lives in Phase 5. */
  grossSalary: Money;
  bankName?: string;
  bankAccountMasked?: string;
  emergencyContacts: EmergencyContact[];
  qualifications: Qualification[];
  experience: WorkExperience[];
  attendancePercent: number;
  leaveBalanceDays: number;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Contracts
// ---------------------------------------------------------------------------

export type ContractType = "permanent" | "fixed-term" | "probation" | "temporary" | "part-time" | "consultant" | "visiting-faculty" | "custom";
export type ContractStatus = "draft" | "active" | "expiring" | "renewal-pending" | "expired" | "terminated";

export const contractStatusLabels: Record<ContractStatus, string> = {
  draft: "Draft",
  active: "Active",
  expiring: "Expiring",
  "renewal-pending": "Renewal pending",
  expired: "Expired",
  terminated: "Terminated",
};

export type Contract = {
  id: ID;
  employeeId: ID;
  type: ContractType;
  startDate: string;
  endDate?: string;
  probationMonths?: number;
  noticePeriodDays: number;
  workHoursPerWeek: number;
  salary: Money;
  terms?: string;
  renewalNote?: string;
  status: ContractStatus;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export type StaffDocumentType = "id-proof" | "tax-id" | "qualification" | "experience-certificate" | "appointment-letter" | "contract" | "license" | "background-check" | "medical-fitness" | "training-certificate" | "custom";

export const staffDocumentTypeLabels: Record<StaffDocumentType, string> = {
  "id-proof": "ID proof",
  "tax-id": "Tax ID",
  qualification: "Qualification",
  "experience-certificate": "Experience certificate",
  "appointment-letter": "Appointment letter",
  contract: "Contract",
  license: "License",
  "background-check": "Background check",
  "medical-fitness": "Medical fitness",
  "training-certificate": "Training certificate",
  custom: "Custom document",
};

export type StaffDocumentStatus = "missing" | "uploaded" | "verified" | "rejected" | "expiring" | "expired";

export const staffDocumentStatusTone: Record<StaffDocumentStatus, "success" | "warning" | "error" | "neutral" | "info"> = {
  missing: "error",
  uploaded: "info",
  verified: "success",
  rejected: "error",
  expiring: "warning",
  expired: "error",
};

export type StaffDocument = {
  id: ID;
  employeeId: ID;
  type: StaffDocumentType;
  label?: string;
  status: StaffDocumentStatus;
  fileName?: string;
  uploadedAt?: string;
  verifiedBy?: string;
  expiryDate?: string;
};

// ---------------------------------------------------------------------------
// Attendance & shifts
// ---------------------------------------------------------------------------

export type HrAttendanceStatus = "present" | "absent" | "late" | "half-day" | "on-leave" | "work-from-home" | "official-duty" | "not-marked";

export const hrAttendanceStatusLabels: Record<HrAttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  "half-day": "Half day",
  "on-leave": "On leave",
  "work-from-home": "Work from home",
  "official-duty": "Official duty",
  "not-marked": "Not marked",
};

export const hrAttendanceStatusTone: Record<HrAttendanceStatus, "success" | "warning" | "error" | "info" | "neutral"> = {
  present: "success",
  absent: "error",
  late: "warning",
  "half-day": "warning",
  "on-leave": "info",
  "work-from-home": "info",
  "official-duty": "info",
  "not-marked": "neutral",
};

export type HrAttendanceRecord = {
  id: ID;
  employeeId: ID;
  date: string;
  status: HrAttendanceStatus;
  shiftId?: ID;
  checkIn?: string;
  checkOut?: string;
  workedHours?: number;
  lateMinutes?: number;
  overtimeMinutes?: number;
  note?: string;
};

export type Shift = {
  id: ID;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  graceMinutes: number;
  lateThresholdMinutes: number;
  halfDayThresholdHours: number;
  days: string[];
  status: "active" | "inactive";
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Leave
// ---------------------------------------------------------------------------

export type HrLeaveType = "casual" | "sick" | "earned" | "maternity" | "paternity" | "medical" | "emergency" | "compensatory" | "unpaid";

export const hrLeaveTypeLabels: Record<HrLeaveType, string> = {
  casual: "Casual",
  sick: "Sick",
  earned: "Earned",
  maternity: "Maternity",
  paternity: "Paternity",
  medical: "Medical",
  emergency: "Emergency",
  compensatory: "Compensatory",
  unpaid: "Unpaid",
};

export type LeaveBalance = {
  id: ID;
  employeeId: ID;
  leaveType: HrLeaveType;
  entitledDays: number;
  usedDays: number;
  pendingDays: number;
};

export type HrLeaveStatus = "draft" | "pending" | "approved" | "rejected" | "cancelled";

export const hrLeaveStatusTone: Record<HrLeaveStatus, "success" | "warning" | "error" | "info" | "neutral"> = {
  draft: "neutral",
  pending: "warning",
  approved: "success",
  rejected: "error",
  cancelled: "neutral",
};

export type HrLeaveRequest = {
  id: ID;
  employeeId: ID;
  leaveType: HrLeaveType;
  startDate: string;
  endDate: string;
  days: number;
  halfDay: boolean;
  reason: string;
  attachmentName?: string;
  contactDuringLeave?: string;
  status: HrLeaveStatus;
  appliedAt: string;
  reviewerId?: ID;
  reviewerNote?: string;
  reviewedAt?: string;
};

// ---------------------------------------------------------------------------
// Recruitment
// ---------------------------------------------------------------------------

export type JobStatus = "draft" | "open" | "paused" | "closed" | "filled";

export const jobStatusLabels: Record<JobStatus, string> = {
  draft: "Draft",
  open: "Open",
  paused: "Paused",
  closed: "Closed",
  filled: "Filled",
};

export type RecruitmentJob = {
  id: ID;
  title: string;
  departmentId: ID;
  designationId?: ID;
  branch: string;
  employmentType: EmploymentType;
  openings: number;
  minExperienceYears: number;
  qualification: string;
  skills: string[];
  salaryMin: Money;
  salaryMax: Money;
  description: string;
  responsibilities: string[];
  requirements: string[];
  deadline: string;
  hiringManagerId?: ID;
  status: JobStatus;
  createdAt: string;
};

export type CandidateStage = "applied" | "screening" | "shortlisted" | "interview" | "assessment" | "offer" | "hired" | "rejected";

export const candidateStageLabels: Record<CandidateStage, string> = {
  applied: "Applied",
  screening: "Screening",
  shortlisted: "Shortlisted",
  interview: "Interview",
  assessment: "Assessment",
  offer: "Offer",
  hired: "Hired",
  rejected: "Rejected",
};

export const CANDIDATE_PIPELINE: CandidateStage[] = ["applied", "screening", "shortlisted", "interview", "assessment", "offer", "hired"];

export type Candidate = {
  id: ID;
  jobId: ID;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  experienceYears: number;
  qualification: string;
  source: "referral" | "job-portal" | "walk-in" | "agency" | "internal" | "website";
  stage: CandidateStage;
  score?: number;
  ownerId?: ID;
  appliedAt: string;
  notes?: string;
};

export type InterviewType = "screening" | "technical" | "teaching-demo" | "hr" | "principal-round" | "final";

export const interviewTypeLabels: Record<InterviewType, string> = {
  screening: "Screening",
  technical: "Technical",
  "teaching-demo": "Teaching demo",
  hr: "HR",
  "principal-round": "Principal round",
  final: "Final",
};

export type InterviewStatus = "scheduled" | "completed" | "cancelled" | "no-show";

export type Interview = {
  id: ID;
  candidateId: ID;
  jobId: ID;
  type: InterviewType;
  date: string;
  time: string;
  durationMinutes: number;
  interviewerIds: ID[];
  location: string;
  videoLink?: string;
  status: InterviewStatus;
  notes?: string;
  rating?: number;
};

// ---------------------------------------------------------------------------
// Onboarding / offboarding
// ---------------------------------------------------------------------------

export type OnboardingTask = {
  id: ID;
  employeeId: ID;
  label: string;
  category: "documents" | "access" | "assets" | "orientation" | "compliance";
  completed: boolean;
  completedAt?: string;
};

export type OffboardingStatus = "initiated" | "notice-period" | "clearance-pending" | "final-settlement" | "completed";

export const offboardingStatusLabels: Record<OffboardingStatus, string> = {
  initiated: "Initiated",
  "notice-period": "Notice period",
  "clearance-pending": "Clearance pending",
  "final-settlement": "Final settlement",
  completed: "Completed",
};

export type OffboardingCase = {
  id: ID;
  employeeId: ID;
  resignationDate: string;
  lastWorkingDate: string;
  reason: string;
  status: OffboardingStatus;
  clearances: { key: string; label: string; cleared: boolean }[];
  exitInterviewDone: boolean;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Performance
// ---------------------------------------------------------------------------

export type PerformanceCycleType = "annual" | "probation" | "mid-year" | "teacher-observation" | "promotion" | "custom";
export type PerformanceCycleStatus = "draft" | "active" | "closed";

export type PerformanceCycle = {
  id: ID;
  name: string;
  type: PerformanceCycleType;
  startDate: string;
  endDate: string;
  status: PerformanceCycleStatus;
  createdAt: string;
};

export type ReviewStage = "self-review" | "manager-review" | "reviewer" | "hr" | "final-discussion" | "completed";

export const reviewStageLabels: Record<ReviewStage, string> = {
  "self-review": "Self review",
  "manager-review": "Manager review",
  reviewer: "Reviewer",
  hr: "HR",
  "final-discussion": "Final discussion",
  completed: "Completed",
};

export const REVIEW_STAGES: ReviewStage[] = ["self-review", "manager-review", "reviewer", "hr", "final-discussion", "completed"];

export type ReviewCriterion = { key: string; label: string; rating?: number; comment?: string };

export type PerformanceReview = {
  id: ID;
  cycleId: ID;
  employeeId: ID;
  reviewerId?: ID;
  stage: ReviewStage;
  criteria: ReviewCriterion[];
  strengths?: string;
  developmentAreas?: string;
  summary?: string;
  overallRating?: number;
  updatedAt: string;
};

export type GoalStatus = "draft" | "active" | "at-risk" | "completed" | "cancelled";

export const goalStatusTone: Record<GoalStatus, "success" | "warning" | "error" | "info" | "neutral"> = {
  draft: "neutral",
  active: "info",
  "at-risk": "warning",
  completed: "success",
  cancelled: "neutral",
};

export type PerformanceGoal = {
  id: ID;
  employeeId: ID;
  title: string;
  category: "teaching" | "professional-development" | "administrative" | "leadership" | "student-outcomes" | "custom";
  startDate: string;
  dueDate: string;
  progress: number;
  keyResults: { label: string; done: boolean }[];
  status: GoalStatus;
};

export type FeedbackSource = "manager" | "peer" | "department-head" | "self";

export type Feedback = {
  id: ID;
  employeeId: ID;
  cycleId?: ID;
  source: FeedbackSource;
  fromMasked: string;
  rating: number;
  comment: string;
  submittedAt: string;
};

// ---------------------------------------------------------------------------
// Training
// ---------------------------------------------------------------------------

export type TrainingCategory = "teaching-methodology" | "technology" | "safety" | "child-protection" | "leadership" | "compliance" | "department-specific" | "custom";

export const trainingCategoryLabels: Record<TrainingCategory, string> = {
  "teaching-methodology": "Teaching methodology",
  technology: "Technology",
  safety: "Safety",
  "child-protection": "Child protection",
  leadership: "Leadership",
  compliance: "Compliance",
  "department-specific": "Department-specific",
  custom: "Custom",
};

export type TrainingStatus = "draft" | "scheduled" | "in-progress" | "completed" | "cancelled";

export type TrainingCourse = {
  id: ID;
  name: string;
  category: TrainingCategory;
  trainer: string;
  deliveryType: "in-person" | "online" | "hybrid";
  durationHours: number;
  startDate: string;
  endDate: string;
  capacity: number;
  mandatory: boolean;
  description: string;
  hasCertificate: boolean;
  status: TrainingStatus;
  createdAt: string;
};

export type EnrollmentStatus = "enrolled" | "in-progress" | "completed" | "overdue" | "cancelled";

export const enrollmentStatusTone: Record<EnrollmentStatus, "success" | "warning" | "error" | "info" | "neutral"> = {
  enrolled: "info",
  "in-progress": "info",
  completed: "success",
  overdue: "error",
  cancelled: "neutral",
};

export type TrainingEnrollment = {
  id: ID;
  courseId: ID;
  employeeId: ID;
  status: EnrollmentStatus;
  progress: number;
  completedAt?: string;
  certificateIssued: boolean;
};

// ---------------------------------------------------------------------------
// Assets, timeline, letters, announcements
// ---------------------------------------------------------------------------

export type EmployeeAssetLink = {
  id: ID;
  employeeId: ID;
  assetName: string;
  assetTag: string;
  assignedAt: string;
};

export type EmployeeTimelineEvent = {
  id: ID;
  employeeId: ID;
  type: "joining" | "role-change" | "confirmation" | "appraisal" | "promotion" | "training" | "award" | "transfer" | "note";
  title: string;
  detail?: string;
  date: string;
};

export type LetterType = "appointment" | "offer" | "experience" | "relieving" | "salary-certificate" | "employment-certificate" | "recommendation" | "training-certificate" | "custom";

export const letterTypeLabels: Record<LetterType, string> = {
  appointment: "Appointment letter",
  offer: "Offer letter",
  experience: "Experience letter",
  relieving: "Relieving letter",
  "salary-certificate": "Salary certificate",
  "employment-certificate": "Employment certificate",
  recommendation: "Recommendation letter",
  "training-certificate": "Training certificate",
  custom: "Custom letter",
};

export type StaffLetter = {
  id: ID;
  employeeId: ID;
  type: LetterType;
  generatedAt: string;
  generatedBy: string;
};

export type HrAnnouncement = {
  id: ID;
  title: string;
  body: string;
  audience: "all-staff" | "teaching" | "non-teaching" | "department";
  departmentId?: ID;
  pinned: boolean;
  publishedAt: string;
};

export type HrPolicy = {
  id: ID;
  title: string;
  category: "leave" | "conduct" | "safety" | "it" | "finance" | "general";
  summary: string;
  updatedAt: string;
  version: string;
};
