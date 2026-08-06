import type { ID } from "./common";

export type ReportCardSectionKey =
  | "header"
  | "student-info"
  | "subject-marks"
  | "grade-summary"
  | "attendance"
  | "co-curricular"
  | "skills"
  | "teacher-remark"
  | "principal-remark"
  | "promotion-status"
  | "signatures"
  | "qr-verification"
  | "footer";

export const reportCardSectionLabels: Record<ReportCardSectionKey, string> = {
  header: "School header",
  "student-info": "Student details",
  "subject-marks": "Subject-wise marks",
  "grade-summary": "Grade summary",
  attendance: "Attendance",
  "co-curricular": "Co-curricular assessment",
  skills: "Skills",
  "teacher-remark": "Teacher remark",
  "principal-remark": "Principal remark",
  "promotion-status": "Promotion status",
  signatures: "Signatures",
  "qr-verification": "QR verification",
  footer: "Footer",
};

export type ReportCardSection = {
  key: ReportCardSectionKey;
  visible: boolean;
  order: number;
};

export type ReportCardTheme = "classic-academic" | "modern-minimal" | "premium-institutional" | "primary-school" | "senior-secondary" | "competency-based";

export const reportCardThemeLabels: Record<ReportCardTheme, string> = {
  "classic-academic": "Classic Academic",
  "modern-minimal": "Modern Minimal",
  "premium-institutional": "Premium Institutional",
  "primary-school": "Primary School",
  "senior-secondary": "Senior Secondary",
  "competency-based": "Competency Based",
};

export type ReportCardTemplate = {
  id: ID;
  name: string;
  theme: ReportCardTheme;
  pageSize: "a4" | "letter";
  orientation: "portrait" | "landscape";
  sections: ReportCardSection[];
  showLogo: boolean;
  showPhoto: boolean;
  showQrVerification: boolean;
  signatureLabels: string[];
  footerNote?: string;
  assignedClassIds: ID[];
  session: string;
  status: "active" | "draft" | "archived";
  createdAt: string;
  updatedAt: string;
};

export type ReportCardStatus = "pending" | "generating" | "generated" | "failed" | "published" | "revoked" | "superseded";

export const reportCardStatusLabels: Record<ReportCardStatus, string> = {
  pending: "Pending",
  generating: "Generating",
  generated: "Generated",
  failed: "Failed",
  published: "Published",
  revoked: "Revoked",
  superseded: "Superseded",
};

export type ReportCard = {
  id: ID;
  examId: ID;
  studentId: ID;
  templateId: ID;
  version: number;
  status: ReportCardStatus;
  generatedAt?: string;
  generatedBy?: string;
  failureReason?: string;
  publishedAt?: string;
  revokedAt?: string;
};

export type ReportCardGenerationJobStatus = "pending" | "running" | "completed" | "completed-with-errors" | "failed";

export type ReportCardGenerationJob = {
  id: ID;
  examId: ID;
  templateId: ID;
  scope: "single" | "class" | "section" | "all";
  classId?: ID;
  sectionId?: ID;
  studentIds: ID[];
  total: number;
  completed: number;
  failed: number;
  status: ReportCardGenerationJobStatus;
  createdBy: string;
  createdAt: string;
  finishedAt?: string;
};

export type TeacherRemarkType = "subject" | "class-teacher" | "principal" | "behaviour" | "improvement";

export const teacherRemarkTypeLabels: Record<TeacherRemarkType, string> = {
  subject: "Subject remark",
  "class-teacher": "Class teacher remark",
  principal: "Principal remark",
  behaviour: "Behaviour remark",
  improvement: "Improvement recommendation",
};

export type TeacherRemark = {
  id: ID;
  examId: ID;
  studentId: ID;
  subjectId?: ID;
  type: TeacherRemarkType;
  text: string;
  aiGenerated: boolean;
  /** Which inputs the AI assistant used, shown to the reviewing teacher for transparency, e.g. "Attendance: 92%", "+8% vs previous exam". */
  aiInfluencedBy?: string[];
  authorName: string;
  authorRole: string;
  createdAt: string;
  updatedAt: string;
};
