// Typed response contracts for the Phase-4 REST APIs (client-safe — plain types
// only, no server imports). These mirror the shapes produced by the server-side
// serializers in lib/server/**. Keep them in sync with those serializers.

export type AddressDto = {
  line1: string | null;
  line2: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
};

export type GuardianChildDto = {
  relation: string;
  isPrimary: boolean;
  isEmergencyContact: boolean;
  authorizedPickup: boolean;
  isFeeResponsible?: boolean;
  student: {
    id: string;
    name: string;
    admissionNumber: string;
    classLabel: string | null;
    sectionLabel: string | null;
    status: string;
  };
};

export type GuardianBaseDto = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  occupation: string | null;
  organization: string | null;
  address: AddressDto;
  photoUrl: string | null;
  hasPortalAccount: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GuardianDto = GuardianBaseDto & {
  children: GuardianChildDto[];
};

// --- Students ---------------------------------------------------------------

export type StudentListItemDto = {
  id: string;
  admissionNumber: string;
  rollNumber: string | null;
  firstName: string;
  middleName: string | null;
  lastName: string;
  fullName: string;
  preferredName: string | null;
  gender: string;
  dateOfBirth: string;
  classLabel: string | null;
  sectionLabel: string | null;
  status: string;
  admissionType: string;
  admissionDate: string;
  branchId: string;
  academicSessionId: string;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StudentGuardianDto = {
  link: {
    relation: string;
    isPrimary: boolean;
    isEmergencyContact: boolean;
    authorizedPickup: boolean;
    isFeeResponsible: boolean;
  };
  guardian: GuardianBaseDto;
};

export type StudentDocumentDto = {
  id: string;
  type: string;
  displayName: string;
  status: string;
  verificationStatus: string;
  fileName: string | null;
  expiryDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StudentTimelineDto = {
  id: string;
  type: string;
  title: string;
  detail: string | null;
  category: string | null;
  actorName: string | null;
  createdAt: string;
};

export type StudentDetailDto = StudentListItemDto & {
  bloodGroup: string | null;
  nationality: string | null;
  religion: string | null;
  category: string | null;
  motherTongue: string | null;
  house: string | null;
  email: string | null;
  phone: string | null;
  address: AddressDto;
  sourceApplicationId: string | null;
  archivedAt: string | null;
  guardians: StudentGuardianDto[];
  documents: StudentDocumentDto[];
  timeline: StudentTimelineDto[];
  admission: { id: string; applicationNumber: string; enrolledAt: string | null } | null;
};

// --- Admissions -------------------------------------------------------------

export type AdmissionListItemDto = {
  id: string;
  applicationNumber: string;
  stage: string;
  draft: boolean;
  priority: string;
  source: string;
  admissionType: string;
  appliedClass: string | null;
  appliedSectionPreference: string | null;
  applicantName: string;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string | null;
  email: string | null;
  phone: string | null;
  branchId: string;
  academicSessionId: string;
  assignedOfficerId: string | null;
  assignedOfficerName: string | null;
  convertedStudentId: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdmissionStageHistoryDto = {
  id: string;
  fromStage: string | null;
  toStage: string;
  changedByName: string | null;
  reason: string | null;
  createdAt: string;
};

export type AdmissionNoteDto = {
  id: string;
  authorName: string;
  authorRole: string | null;
  body: string;
  pinned: boolean;
  createdAt: string;
};

export type AdmissionDocumentDto = {
  id: string;
  type: string;
  displayName: string;
  status: string;
  verificationStatus: string;
  fileName: string | null;
  expiryDate: string | null;
  notes: string | null;
  createdAt: string;
};

export type AdmissionApplicantGuardianDto = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  occupation?: string;
  organization?: string;
  relation?: string;
  isPrimary?: boolean;
  isEmergencyContact?: boolean;
  authorizedPickup?: boolean;
};

export type AdmissionDetailDto = AdmissionListItemDto & {
  address: AddressDto;
  guardians: AdmissionApplicantGuardianDto[];
  details: Record<string, unknown>;
  approvedAt: string | null;
  rejectedAt: string | null;
  enrolledAt: string | null;
  stageHistory: AdmissionStageHistoryDto[];
  notes: AdmissionNoteDto[];
  documents: AdmissionDocumentDto[];
};

// Conversion result.
export type AdmissionConvertResultDto = {
  studentId: string;
  admissionNumber: string;
  applicationId: string;
};

export type AdmissionStatsDto = {
  total: number;
  byStage: Record<string, number>;
  bySource: Record<string, number>;
  approved: number;
  rejected: number;
  enrolled: number;
  waitlisted: number;
};
