import type { Address, CommunicationPreference, ContactInfo, DocumentRecord, ID, StatusTone, TimelineEvent } from "./common";

export type StudentStatus = "active" | "inactive" | "alumni" | "transferred" | "archived";

export const studentStatusLabels: Record<StudentStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  alumni: "Alumni",
  transferred: "Transferred",
  archived: "Archived",
};

export type Gender = "male" | "female" | "other" | "prefer-not-to-say";

export type StudentProfile = {
  firstName: string;
  middleName?: string;
  lastName: string;
  preferredName?: string;
  dob: string;
  gender: Gender;
  bloodGroup?: string;
  nationality: string;
  religion?: string;
  category?: string;
  motherTongue?: string;
  photoUrl?: string;
  house?: string;
};

/** Lightweight, denormalized display snapshot embedded on the student record
 * for cards/lists — the Phase 6 transport module owns the real relational
 * assignment (see `StudentTransportAssignment` in lib/types/transport.ts). */
export type StudentTransportSummary = {
  routeId: string;
  routeName: string;
  stopName: string;
  pickupTime: string;
  dropTime: string;
};

export type StudentHostelAssignment = {
  blockId: string;
  blockName: string;
  roomNumber: string;
};

export type StudentAcademicSummary = {
  overallPercent: number;
  classRank?: number;
  classSize?: number;
  trend: "up" | "down" | "flat";
  upcomingExams: { id: ID; subject: string; date: string }[];
  recentHomework: { id: ID; subject: string; title: string; dueDate: string; status: "submitted" | "pending" | "late" }[];
  subjectsAtRisk: string[];
};

export type StudentAttendanceSummary = {
  presentPercent: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  totalDays: number;
  todayStatus: "present" | "absent" | "late" | "not-marked" | "holiday";
  trend7Day: number[];
};

export type StudentFeeStatus = "paid" | "partial" | "overdue" | "pending";

export type StudentFeeSummary = {
  status: StudentFeeStatus;
  totalDue: number;
  totalPaid: number;
  overdueAmount: number;
  nextDueDate?: string;
  feeStructureId?: string;
};

export type StudentHealthRecord = {
  bloodGroup?: string;
  allergies: string[];
  conditions: string[];
  medications: string[];
  emergencyContactName: string;
  emergencyContactPhone: string;
  lastCheckup?: string;
  physicianName?: string;
};

export type BehaviourNote = {
  id: ID;
  type: "positive" | "concern" | "incident";
  title: string;
  detail: string;
  recordedBy: string;
  createdAt: string;
};

export type PulseDimensionKey = "academics" | "attendance" | "engagement" | "behaviour" | "homework" | "wellbeing";

export type PulseDimension = {
  key: PulseDimensionKey;
  label: string;
  score: number;
  tone: StatusTone;
  trend: "up" | "down" | "flat";
  summary: string;
};

export type StudentPulse = {
  overallScore: number;
  status: "excellent" | "good" | "needs-attention" | "critical";
  positiveTrend: string;
  mainRisk: string;
  suggestedAction: string;
  explanation: string;
  dimensions: PulseDimension[];
};

export type StudentGuardianRelationship = "father" | "mother" | "guardian";

export type StudentGuardianLink = {
  studentId: ID;
  guardianId: ID;
  relationship: StudentGuardianRelationship;
  isPrimary: boolean;
  isEmergencyContact: boolean;
  isAuthorizedPickup: boolean;
  isFeeResponsible: boolean;
};

export type Student = {
  id: ID;
  admissionNumber: string;
  rollNumber?: string;
  profile: StudentProfile;
  classId: string;
  sectionId: string;
  session: string;
  branchId: string;
  status: StudentStatus;
  admissionDate: string;
  admissionType: "new" | "transfer" | "sibling" | "staff-ward" | "management-quota";
  address: Address;
  guardianIds: ID[];
  primaryGuardianId: ID;
  transport?: StudentTransportSummary;
  hostel?: StudentHostelAssignment;
  academics: StudentAcademicSummary;
  attendance: StudentAttendanceSummary;
  fees: StudentFeeSummary;
  health: StudentHealthRecord;
  behaviourNotes: BehaviourNote[];
  pulse: StudentPulse;
  documents: DocumentRecord[];
  timeline: TimelineEvent[];
  sourceApplicationId?: string;
  createdAt: string;
  updatedAt: string;
};

export type Guardian = {
  id: ID;
  firstName: string;
  lastName: string;
  occupation?: string;
  organization?: string;
  contact: ContactInfo;
  address?: Address;
  communicationPreference: CommunicationPreference;
  photoUrl?: string;
};

export type ParentPortalStatus = "not-invited" | "invited" | "active" | "suspended";

export type ParentLoginEvent = { id: ID; at: string; device: string; ip: string };

export type ParentAccount = {
  id: ID;
  guardianId: ID;
  portalStatus: ParentPortalStatus;
  invitedAt?: string;
  lastLoginAt?: string;
  loginHistory: ParentLoginEvent[];
  consentForms: { id: ID; title: string; signedAt?: string; status: "pending" | "signed" }[];
};

export type StudentFilters = {
  search?: string;
  classId?: string[];
  sectionId?: string[];
  status?: StudentStatus[];
  admissionType?: string[];
  feeStatus?: StudentFeeStatus[];
  transportRouteId?: string[];
  hasHostel?: boolean;
  gender?: Gender[];
  missingDocumentsOnly?: boolean;
  attendanceBelow?: number;
  branchId?: string;
  session?: string;
};
