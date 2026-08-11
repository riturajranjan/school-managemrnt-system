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

// --- Platform (Super Admin) schools -----------------------------------------

export type PlatformSchoolListItemDto = {
  id: string;
  name: string;
  code: string;
  status: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  branchCount: number;
  currentSessionName: string | null;
  createdAt: string;
};

export type PlatformSchoolDetailDto = {
  school: {
    id: string;
    name: string;
    shortName: string | null;
    code: string;
    schoolType: string | null;
    board: string | null;
    email: string | null;
    phone: string | null;
    website: string | null;
    timezone: string;
    locale: string;
    currency: string;
    status: string;
    setupPending: boolean;
    createdAt: string;
    updatedAt: string;
  };
  tenant: { id: string; name: string; slug: string; status: string };
  branches: { id: string; name: string; code: string; isPrimary: boolean; status: string; city: string | null }[];
  currentSession: { id: string; name: string; code: string; startDate: string; endDate: string } | null;
  admins: { userId: string; name: string | null; email: string; status: string; invitePending: boolean }[];
};

export type PlatformProvisionResultDto = {
  schoolId: string;
  tenantId: string;
  adminUserId: string;
  adminInvitePending: boolean;
};

// --- Platform (Super Admin) onboarding (SA-3) --------------------------------

export type OnboardingStepDto = { key: string; label: string; description: string; done: boolean };

export type OnboardingDto = {
  schoolId: string;
  tenantId: string;
  status: string; // not-started | in-progress | completed
  currentStep: string;
  completedSteps: string[];
  steps: OnboardingStepDto[];
  totalSteps: number;
  completedCount: number;
  progress: number; // 0..100, computed from steps
  startedAt: string;
  completedAt: string | null;
  school: { id: string; name: string; code: string; status: string };
};

// --- Platform (Super Admin) plans (SA-4A) ------------------------------------

export type PlanDto = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string; // draft | active | archived
  billingInterval: string; // monthly | yearly
  currency: string; // ISO-4217, formatted client-side
  price: number;
  trialDays: number;
  isPublic: boolean;
  sortOrder: number;
  limits: { maxStudents: number | null; maxStaff: number | null; maxBranches: number | null; storageGb: number | null };
  supportLevel: string | null;
  whiteLabel: boolean;
  features: string[];
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

// --- Platform (Super Admin) subscriptions (SA-4B) ----------------------------

export type SubscriptionDto = {
  id: string;
  status: string; // trialing | active | past-due | cancelled | ended
  isCurrent: boolean;
  school: { id: string; name: string; code: string; status: string };
  tenant: { id: string; name: string; slug: string };
  plan: {
    id: string;
    code: string;
    name: string;
    status: string;
    price: number; // live plan price
    currency: string;
    billingInterval: string;
    limits: { maxStudents: number | null; maxStaff: number | null; maxBranches: number | null; storageGb: number | null };
    features: string[];
  };
  // Snapshotted commercial terms (may differ from the live plan price).
  price: number;
  currency: string;
  billingInterval: string;
  startDate: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialStart: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  cancelledAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

// --- Platform (Super Admin) trials (SA-4C) -----------------------------------
// A trial is a Subscription with a trial window — not a separate model. `state`
// and `daysRemaining` are derived server-side from persisted trial dates.

export type TrialDto = {
  subscriptionId: string;
  state: string; // active | expiring | expired | converted | ended
  status: string; // underlying subscription status (trialing | active | ended)
  school: { id: string; name: string; code: string; status: string };
  tenant: { id: string; name: string; slug: string };
  plan: { id: string; code: string; name: string; price: number; currency: string; billingInterval: string };
  trialStart: string | null;
  trialEnd: string | null;
  daysRemaining: number; // server-computed; may be ≤0 when expired
  currentPeriodStart: string;
  currentPeriodEnd: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

// --- Platform (Super Admin) billing + invoices (SA-4D) -----------------------

export type BillingSummaryDto = {
  currency: string;
  activeSubscriptions: number;
  trialingSubscriptions: number;
  mrr: number;
  arr: number;
  openInvoices: number;
  overdueInvoices: number;
  outstandingAmount: number;
  collectedAmount: number; // real cash collected (all-time) from SUCCEEDED payments
};

export type InvoiceLineItemDto = {
  id: string;
  description: string;
  quantity: number;
  unitAmount: number;
  amount: number;
};

export type InvoiceDto = {
  id: string;
  invoiceNumber: string;
  status: string; // draft | open | paid | void
  derivedState: string; // draft | open | overdue | paid | void
  school: { id: string; name: string; code: string };
  tenant: { id: string; name: string; slug: string };
  subscription: { id: string; status: string; planCode: string; planName: string; billingInterval: string };
  currency: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  periodStart: string;
  periodEnd: string;
  issuedAt: string | null;
  dueAt: string;
  paidAt: string | null;
  voidedAt: string | null;
  lineItems: InvoiceLineItemDto[];
  payments: InvoicePaymentSummaryDto[];
  createdAt: string;
  updatedAt: string;
};

export type InvoicePaymentSummaryDto = {
  id: string;
  paymentNumber: string;
  amount: number;
  method: string;
  status: string; // succeeded | reversed
  receivedAt: string;
  reference: string | null;
  reversedAt: string | null;
};

// --- Platform (Super Admin) payments (SA-4E) ---------------------------------

export type PaymentDto = {
  id: string;
  paymentNumber: string;
  status: string; // succeeded | reversed
  method: string; // cash | bank-transfer | upi | cheque | other
  amount: number;
  currency: string;
  reference: string | null;
  notes: string | null;
  receivedAt: string;
  reversedAt: string | null;
  recordedBy: { id: string | null; name: string | null };
  invoice: { id: string; invoiceNumber: string; status: string; totalAmount: number; amountDue: number };
  school: { id: string; name: string; code: string };
  tenant: { id: string; name: string; slug: string };
  subscription: { id: string; planCode: string; planName: string };
  createdAt: string;
  updatedAt: string;
};
