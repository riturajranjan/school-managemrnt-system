// Bidirectional maps between Prisma enums (UPPER_SNAKE) and the existing UI
// vocabularies (kebab-case). The REST APIs speak the UI shapes so the frontend
// migrates without a translation layer of its own.
import type {
  AdmissionSource as DbAdmissionSource,
  AdmissionStage as DbAdmissionStage,
  AdmissionType as DbAdmissionType,
  BillingInterval as DbBillingInterval,
  DocVerificationStatus as DbDocVerification,
  Gender as DbGender,
  GuardianRelation as DbGuardianRelation,
  InvoiceStatus as DbInvoiceStatus,
  PaymentMethod as DbPaymentMethod,
  PaymentStatus as DbPaymentStatus,
  PlanStatus as DbPlanStatus,
  SchoolStatus as DbSchoolStatus,
  StudentStatus as DbStudentStatus,
  SubscriptionStatus as DbSubscriptionStatus,
  SupportTicketCategory as DbSupportCategory,
  SupportTicketPriority as DbSupportPriority,
  SupportTicketStatus as DbSupportStatus,
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

/** Platform school lifecycle (Super Admin SA-2). */
export const schoolStatusToUi: Record<DbSchoolStatus, string> = {
  SETUP_PENDING: "setup-pending",
  ACTIVE: "active",
  SUSPENDED: "suspended",
  INACTIVE: "inactive",
  ARCHIVED: "archived",
};
export const schoolStatusFromUi = invert(schoolStatusToUi);

/** Plan lifecycle + billing interval (Super Admin SA-4A). */
export const planStatusToUi: Record<DbPlanStatus, string> = {
  DRAFT: "draft",
  ACTIVE: "active",
  ARCHIVED: "archived",
};
export const planStatusFromUi = invert(planStatusToUi);

export const billingIntervalToUi: Record<DbBillingInterval, string> = {
  MONTHLY: "monthly",
  YEARLY: "yearly",
};
export const billingIntervalFromUi = invert(billingIntervalToUi);

/** Subscription lifecycle (Super Admin SA-4B). */
export const subscriptionStatusToUi: Record<DbSubscriptionStatus, string> = {
  TRIALING: "trialing",
  ACTIVE: "active",
  PAST_DUE: "past-due",
  CANCELLED: "cancelled",
  ENDED: "ended",
};
export const subscriptionStatusFromUi = invert(subscriptionStatusToUi);

/** Invoice lifecycle (Super Admin SA-4D). OVERDUE is derived, not stored. */
export const invoiceStatusToUi: Record<DbInvoiceStatus, string> = {
  DRAFT: "draft",
  OPEN: "open",
  PAID: "paid",
  VOID: "void",
};
export const invoiceStatusFromUi = invert(invoiceStatusToUi);

/** Payment lifecycle + method (Super Admin SA-4E). Manual/offline methods only. */
export const paymentStatusToUi: Record<DbPaymentStatus, string> = {
  SUCCEEDED: "succeeded",
  REVERSED: "reversed",
};
export const paymentStatusFromUi = invert(paymentStatusToUi);

export const paymentMethodToUi: Record<DbPaymentMethod, string> = {
  CASH: "cash",
  BANK_TRANSFER: "bank-transfer",
  UPI: "upi",
  CHEQUE: "cheque",
  OTHER: "other",
};
export const paymentMethodFromUi = invert(paymentMethodToUi);

/** Support ticket lifecycle / priority / category (Super Admin SA-4I). */
export const supportStatusToUi: Record<DbSupportStatus, string> = {
  OPEN: "open",
  IN_PROGRESS: "in-progress",
  WAITING_CUSTOMER: "waiting-customer",
  RESOLVED: "resolved",
  CLOSED: "closed",
};
export const supportStatusFromUi = invert(supportStatusToUi);

export const supportPriorityToUi: Record<DbSupportPriority, string> = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  URGENT: "urgent",
};
export const supportPriorityFromUi = invert(supportPriorityToUi);

export const supportCategoryToUi: Record<DbSupportCategory, string> = {
  BILLING: "billing",
  ACCOUNT: "account",
  TECHNICAL: "technical",
  ONBOARDING: "onboarding",
  FEATURE: "feature",
  OTHER: "other",
};
export const supportCategoryFromUi = invert(supportCategoryToUi);
