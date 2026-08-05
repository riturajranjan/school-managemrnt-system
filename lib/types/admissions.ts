import type { Address, CommunicationPreference, ContactInfo, DocumentRecord, ID, TimelineEvent } from "./common";

export type AdmissionStageKey =
  | "new-enquiry"
  | "application-started"
  | "documents-pending"
  | "under-review"
  | "interview-scheduled"
  | "approved"
  | "fee-pending"
  | "enrolled"
  | "rejected"
  | "waitlisted";

export type AdmissionStageDefinition = {
  key: AdmissionStageKey;
  label: string;
  order: number;
  description: string;
};

// Canonical pipeline order. "rejected" and "waitlisted" are terminal/side
// branches, not steps a card advances through with Next/Back, so they're
// kept last and handled as explicit actions rather than pipeline neighbours.
export const admissionStageDefinitions: AdmissionStageDefinition[] = [
  { key: "new-enquiry", label: "New enquiry", order: 1, description: "First contact, no application yet" },
  { key: "application-started", label: "Application started", order: 2, description: "Form in progress" },
  { key: "documents-pending", label: "Documents pending", order: 3, description: "Awaiting required uploads" },
  { key: "under-review", label: "Under review", order: 4, description: "Admissions team reviewing" },
  { key: "interview-scheduled", label: "Interview scheduled", order: 5, description: "Awaiting interview outcome" },
  { key: "approved", label: "Approved", order: 6, description: "Cleared for enrollment" },
  { key: "fee-pending", label: "Fee pending", order: 7, description: "Awaiting admission fee" },
  { key: "enrolled", label: "Enrolled", order: 8, description: "Converted to student" },
  { key: "rejected", label: "Rejected", order: 9, description: "Application declined" },
  { key: "waitlisted", label: "Waitlisted", order: 10, description: "Seat unavailable, on hold" },
];

export const forwardStageOrder: AdmissionStageKey[] = [
  "new-enquiry",
  "application-started",
  "documents-pending",
  "under-review",
  "interview-scheduled",
  "approved",
  "fee-pending",
  "enrolled",
];

export type AdmissionType = "new" | "transfer" | "sibling" | "staff-ward" | "management-quota";

export type AdmissionSource =
  | "website"
  | "walk-in"
  | "referral"
  | "social-media"
  | "education-fair"
  | "agent"
  | "phone-enquiry";

export const admissionSourceLabels: Record<AdmissionSource, string> = {
  website: "Website",
  "walk-in": "Walk-in",
  referral: "Referral",
  "social-media": "Social media",
  "education-fair": "Education fair",
  agent: "Agent",
  "phone-enquiry": "Phone enquiry",
};

export type Gender = "male" | "female" | "other" | "prefer-not-to-say";

export type GuardianRole = "father" | "mother" | "guardian";

export type ApplicantGuardian = {
  id: ID;
  role: GuardianRole;
  firstName: string;
  lastName: string;
  relationship?: string;
  occupation?: string;
  organization?: string;
  contact: ContactInfo;
  address?: Address;
  isPrimary: boolean;
  isEmergencyContact: boolean;
  authorizedPickup: boolean;
  communicationPreference: CommunicationPreference;
};

export type AdmissionInterviewStatus = "scheduled" | "completed" | "cancelled" | "no-show";
export type AdmissionInterviewResult = "recommended" | "not-recommended" | "waitlist";

export type AdmissionInterview = {
  id: ID;
  scheduledAt: string;
  mode: "in-person" | "phone" | "video";
  interviewerName: string;
  location?: string;
  status: AdmissionInterviewStatus;
  result?: AdmissionInterviewResult;
  notes?: string;
};

export type AdmissionNote = {
  id: ID;
  authorName: string;
  authorRole: string;
  body: string;
  createdAt: string;
  pinned?: boolean;
};

export type AdmissionPayment = {
  id: ID;
  label: string;
  amount: number;
  status: "pending" | "paid" | "waived" | "refunded";
  dueDate?: string;
  paidAt?: string;
  method?: "upi" | "card" | "cash" | "bank-transfer";
  reference?: string;
};

export type ApplicantStudentDetails = {
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
};

export type PreviousSchoolDetails = {
  schoolName: string;
  board?: string;
  lastClassCompleted: string;
  yearOfLeaving?: string;
  reasonForLeaving?: string;
  tcNumber?: string;
};

export type AcademicDetails = {
  preferredSecondLanguage?: string;
  extracurricularInterests?: string;
  specialNeeds?: string;
  siblingStudentId?: string;
};

export type MedicalInfo = {
  allergies?: string;
  conditions?: string;
  medications?: string;
  emergencyContact: string;
  emergencyPhone: string;
  physicianName?: string;
};

export type TransportRequirement = {
  required: boolean;
  routeId?: string;
  pickupStop?: string;
};

export type HostelRequirement = {
  required: boolean;
  blockPreference?: "boys" | "girls" | "co-ed";
};

export type ApplicationFeeDetails = {
  applicationFeePaid: boolean;
  applicationFeeReference?: string;
  admissionFeeStructureId?: string;
};

export type AdmissionApplication = {
  id: ID;
  applicationNumber: string;
  session: string;
  branchId: string;
  draft: boolean;
  stage: AdmissionStageKey;
  priority: "high" | "medium" | "low";
  source: AdmissionSource;
  appliedClassId: string;
  appliedSectionPreference?: string;
  admissionType: AdmissionType;

  student: ApplicantStudentDetails;
  guardians: ApplicantGuardian[];
  address: Address;
  previousSchool?: PreviousSchoolDetails;
  academicDetails?: AcademicDetails;
  medicalInfo?: MedicalInfo;
  transport: TransportRequirement;
  hostel: HostelRequirement;
  feeDetails: ApplicationFeeDetails;

  documents: DocumentRecord[];
  interview?: AdmissionInterview;
  notes: AdmissionNote[];
  payments: AdmissionPayment[];
  timeline: TimelineEvent[];

  assignedOfficerId?: string;
  assignedOfficerName?: string;

  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
  convertedStudentId?: string;
  formStep?: number;
};

export type AdmissionApplicationFilters = {
  search?: string;
  stage?: AdmissionStageKey[];
  appliedClassId?: string[];
  source?: AdmissionSource[];
  assignedOfficerId?: string[];
  missingDocumentsOnly?: boolean;
  branchId?: string;
  session?: string;
};
