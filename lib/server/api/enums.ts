// Bidirectional maps between Prisma enums (UPPER_SNAKE) and the existing UI
// vocabularies (kebab-case). The REST APIs speak the UI shapes so the frontend
// migrates without a translation layer of its own.
import type {
  AdmissionSource as DbAdmissionSource,
  AdmissionStage as DbAdmissionStage,
  AdmissionType as DbAdmissionType,
  DocVerificationStatus as DbDocVerification,
  Gender as DbGender,
  GuardianRelation as DbGuardianRelation,
  StudentStatus as DbStudentStatus,
} from "@/lib/generated/prisma/enums";

function invert<K extends string, V extends string>(map: Record<K, V>): Record<V, K> {
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k])) as Record<V, K>;
}

export const studentStatusToUi: Record<DbStudentStatus, string> = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  ALUMNI: "alumni",
  TRANSFERRED: "transferred",
  ARCHIVED: "archived",
};
export const studentStatusFromUi = invert(studentStatusToUi);

export const genderToUi: Record<DbGender, string> = {
  MALE: "male",
  FEMALE: "female",
  OTHER: "other",
  PREFER_NOT_TO_SAY: "prefer-not-to-say",
};
export const genderFromUi = invert(genderToUi);

export const admissionTypeToUi: Record<DbAdmissionType, string> = {
  NEW: "new",
  TRANSFER: "transfer",
  SIBLING: "sibling",
  STAFF_WARD: "staff-ward",
  MANAGEMENT_QUOTA: "management-quota",
};
export const admissionTypeFromUi = invert(admissionTypeToUi);

export const admissionSourceToUi: Record<DbAdmissionSource, string> = {
  WEBSITE: "website",
  WALK_IN: "walk-in",
  REFERRAL: "referral",
  SOCIAL_MEDIA: "social-media",
  EDUCATION_FAIR: "education-fair",
  AGENT: "agent",
  PHONE_ENQUIRY: "phone-enquiry",
};
export const admissionSourceFromUi = invert(admissionSourceToUi);

export const admissionStageToUi: Record<DbAdmissionStage, string> = {
  NEW_ENQUIRY: "new-enquiry",
  APPLICATION_STARTED: "application-started",
  DOCUMENTS_PENDING: "documents-pending",
  UNDER_REVIEW: "under-review",
  INTERVIEW_SCHEDULED: "interview-scheduled",
  APPROVED: "approved",
  FEE_PENDING: "fee-pending",
  ENROLLED: "enrolled",
  REJECTED: "rejected",
  WAITLISTED: "waitlisted",
};
export const admissionStageFromUi = invert(admissionStageToUi);

export const guardianRelationToUi: Record<DbGuardianRelation, string> = {
  FATHER: "father",
  MOTHER: "mother",
  GUARDIAN: "guardian",
};
export const guardianRelationFromUi = invert(guardianRelationToUi);

export const docVerificationToUi: Record<DbDocVerification, string> = {
  PENDING: "pending",
  VERIFIED: "verified",
  REJECTED: "rejected",
};
export const docVerificationFromUi = invert(docVerificationToUi);
