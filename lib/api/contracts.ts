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

// --- Platform (Super Admin) tenant health + pulse (SA-4F) --------------------
// Health is DERIVED server-side from real signals (school/onboarding/subscription/
// invoice/payment). Read-only — there is no health mutation.

export type TenantHealthDto = {
  schoolId: string;
  schoolName: string;
  schoolCode: string;
  schoolStatus: string;
  tenantId: string;
  tenantName: string;
  onboardingStatus: string; // not-started | in-progress | completed | none
  subscriptionId: string | null;
  subscriptionStatus: string | null;
  plan: string | null;
  trialEnd: string | null;
  trialDaysRemaining: number | null;
  overdueInvoices: number;
  outstandingAmount: number;
  lastPaymentAt: string | null;
  healthState: string; // healthy | attention | critical
  reasons: string[];
};

export type PlatformPulseFactorDto = {
  key: string;
  label: string;
  score: number;
  displayValue: string;
  tone: "success" | "warning" | "error";
};

export type HealthSummaryDto = {
  currency: string;
  totalSchools: number;
  healthy: number;
  attention: number;
  critical: number;
  setupPending: number;
  activeSubscriptions: number;
  trialingSubscriptions: number;
  pastDueSubscriptions: number;
  overdueInvoices: number;
  outstandingAmount: number;
  pulse: { score: number; factors: PlatformPulseFactorDto[] };
};

// --- Platform (Super Admin) dashboard summary (SA-4J) ------------------------

export type DashboardSummaryDto = {
  totalSchools: number;
  activeSchools: number;
  setupPendingSchools: number;
  suspendedSchools: number;
  newSchoolsThisMonth: number; // createdAt >= start of current calendar month (UTC)
};

// --- Platform (Super Admin) support (SA-4I) ----------------------------------

export type SupportTicketDto = {
  id: string;
  ticketNumber: string;
  subject: string;
  category: string;
  priority: string; // low | medium | high | urgent
  status: string; // open | in-progress | waiting-customer | resolved | closed
  escalated: boolean; // derived
  tenant: { id: string; name: string };
  school: { id: string; name: string; code: string } | null;
  assignedTo: { userId: string; name: string | null } | null;
  openedAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SupportMessageDto = {
  id: string;
  authorUserId: string | null;
  authorName: string;
  body: string;
  createdAt: string;
};

export type SupportTicketDetailDto = SupportTicketDto & {
  description: string;
  messages: SupportMessageDto[];
  internalNotes: SupportMessageDto[];
  health: { state: string; reasons: string[] } | null; // real SA-4F tenant health
};

export type SupportAgentDto = { userId: string; name: string | null; email: string; role: string };

export type SupportSummaryDto = {
  openTickets: number;
  urgentTickets: number;
  escalatedTickets: number;
  unassignedTickets: number;
};

// --- Platform (Super Admin) global search (SA-4H) ----------------------------

export type SearchResultDto = {
  type: string; // school | subscription | invoice | payment | plan
  id: string;
  title: string;
  subtitle: string;
  href: string;
  status: string | null;
};

export type GlobalSearchDto = {
  query: string;
  results: SearchResultDto[];
};

// --- Platform (Super Admin) usage & limits (SA-4G) ---------------------------
// Usage is DERIVED live from real rows vs the current subscription's Plan limits.
// Staff/storage are NOT_TRACKED (no real backend) — never fabricated.

export type UsageMetricDto = {
  key: string; // students | branches | staff | storage
  label: string;
  used: number | null; // null when NOT_TRACKED
  limit: number | null; // null = unlimited / no plan
  percent: number | null;
  state: string; // NORMAL | WARNING | LIMIT_REACHED | UNLIMITED | NOT_TRACKED | NO_SUBSCRIPTION
  unit: string | null;
};

export type SchoolUsageDto = {
  schoolId: string;
  schoolName: string;
  schoolCode: string;
  tenantId: string;
  tenantName: string;
  subscriptionId: string | null;
  plan: { id: string; name: string } | null;
  metrics: UsageMetricDto[];
  warnings: string[];
};

export type UsageSummaryDto = {
  schoolsTracked: number;
  schoolsWarning: number;
  schoolsAtLimit: number;
  limitWarnings: number;
  studentLimitWarnings: number;
  branchLimitWarnings: number;
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

// --- Super Admin SA-4L: Features / Domains / Branding ---

export type EffectiveFeatureDto = {
  key: string;
  label: string;
  planDefault: boolean;
  override: boolean | null;
  effective: boolean;
  reason: string | null;
};

export type SchoolFeaturesDto = {
  school: { id: string; name: string };
  tenant: { id: string };
  plan: { id: string; name: string } | null;
  hasSubscription: boolean;
  features: EffectiveFeatureDto[];
};

export type SchoolDomainDto = {
  id: string;
  hostname: string;
  type: string; // subdomain | custom
  status: string; // pending | verified | failed | disabled
  isPrimary: boolean;
  verificationToken: string | null;
  verifiedAt: string | null;
  school: { id: string; name: string };
  tenant: { id: string };
  createdAt: string;
  updatedAt: string;
};

export type SchoolBrandingDto = {
  school: { id: string; name: string };
  tenant: { id: string };
  displayName: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  loginHeadline: string | null;
  loginSubheadline: string | null;
  footerText: string | null;
  updatedAt: string | null;
};

// --- Super Admin SA-4M: Add-ons / Marketplace ---

export type AddOnDto = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  status: string; // draft | active | archived
  priceAmount: number | null;
  currency: string;
  billingInterval: string | null; // monthly | yearly | null
  assignedSchoolCount: number;
  createdAt: string;
  updatedAt: string;
};

export type SchoolAddOnDto = {
  id: string;
  schoolId: string;
  addOn: { id: string; code: string; name: string; category: string | null };
  status: string; // active | ended
  startedAt: string;
  endedAt: string | null;
  priceAmount: number | null; // snapshot
  currency: string | null;
  billingInterval: string | null;
};

export type MarketplaceAppDto = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  providerName: string | null;
  status: string; // draft | active | archived
  documentationUrl: string | null;
  installedSchoolCount: number;
  /** Honest external boundary — no live provider connection exists in this phase. */
  connectionConfigured: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SchoolMarketplaceInstallationDto = {
  id: string;
  schoolId: string;
  app: { id: string; code: string; name: string; category: string; providerName: string | null };
  status: string; // installed | disabled
  installedAt: string;
  disabledAt: string | null;
  configuration: Record<string, unknown> | null; // non-secret metadata only
  connectionConfigured: boolean;
};

// --- Super Admin SA-4N: System (Settings / Admins / Announcements / Status / Audit) ---

export type PlatformSettingsDto = {
  platformName: string;
  supportEmail: string | null;
  defaultLocale: string;
  defaultTimezone: string;
  defaultCurrency: string;
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  signupEnabled: boolean;
  defaultTrialDays: number;
  updatedAt: string;
};

export type PlatformAdminDto = {
  id: string; // PlatformAdmin id
  userId: string;
  name: string | null;
  email: string;
  role: string; // SUPER_ADMIN | SUPPORT | BILLING | AUDITOR
  status: string; // active | invited | suspended | ... (UserStatus, lowercased)
  invitePending: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PlatformAnnouncementDto = {
  id: string;
  title: string;
  body: string;
  category: string | null;
  status: string; // draft | published | archived
  audience: string; // all-platform-users | platform-admins | all-schools
  startsAt: string | null;
  endsAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlatformIncidentDto = {
  id: string;
  title: string;
  description: string | null;
  severity: string; // minor | major | critical
  status: string; // investigating | identified | monitoring | resolved
  startedAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlatformStatusDto = {
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  databaseReachable: boolean;
  openIncidentCount: number;
  activeIncidents: PlatformIncidentDto[];
  // Services with no real telemetry — honestly reported as not monitored.
  unmonitoredServices: string[];
  checkedAt: string;
};

export type AuditEventDto = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actor: { userId: string | null; name: string | null };
  tenantId: string | null;
  schoolId: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
};

// --- Phase 6-pre: Academics foundation (Class / Section / Enrollment) ---

export type ClassDto = {
  id: string;
  name: string;
  order: number;
  status: string; // active | archived
  sectionCount: number;
  capacity: number; // sum of section capacities
  enrolledCount: number;
};

export type SectionDto = {
  id: string;
  classId: string;
  className: string;
  name: string;
  capacity: number;
  status: string; // active | archived
  branchId: string;
  enrolledCount: number;
};

export type RosterEntryDto = {
  enrollmentId: string;
  status: string; // enrolled | transferred | withdrawn
  rollNumber: string | null;
  student: { id: string; name: string; admissionNumber: string; status: string };
};

export type EnrollableStudentDto = {
  id: string;
  name: string;
  admissionNumber: string;
  classLabel: string | null;
  sectionLabel: string | null;
};

// --- Phase 6: Academics Core — Subjects ---

/** Subject UI vocabulary: type is kebab-case, status is active | inactive. */
export type SubjectType = "core" | "elective" | "optional" | "practical" | "language" | "co-curricular";

export type SubjectDto = {
  id: string;
  code: string;
  name: string;
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
  order: number;
  status: string; // active | inactive
  /** Number of classes this subject is currently assigned to (real ClassSubject rows). */
  classCount: number;
};

/** One class→subject assignment (session-scoped). */
export type ClassSubjectDto = {
  id: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  subjectColor: string;
  isCore: boolean;
  order: number;
};

// --- Phase 6A: Staff / Teacher foundation ---

export type StaffStatus = "active" | "inactive" | "archived";
export type EmploymentType = "full-time" | "part-time" | "contract" | "temporary";

export type StaffListItemDto = {
  id: string;
  employeeCode: string;
  name: string; // displayName, else "first last"
  designation: string | null;
  department: string | null;
  employmentType: EmploymentType | null;
  isTeaching: boolean;
  status: StaffStatus;
  branchId: string;
  email: string | null;
  hasUser: boolean; // whether a login account is linked (id never exposed in list)
};

export type StaffDetailDto = StaffListItemDto & {
  firstName: string;
  lastName: string | null;
  displayName: string | null;
  phone: string | null;
  joiningDate: string | null; // YYYY-MM-DD
  userId: string | null;
  userEmail: string | null; // resolved from the linked account, if any
};

/** Minimal teaching-staff option for academics/timetable pickers. */
export type TeachingStaffOptionDto = {
  id: string;
  name: string;
  employeeCode: string;
  designation: string | null;
};

/** One teacher↔(section, subject) assignment. */
export type TeachingAssignmentDto = {
  id: string;
  sectionId: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  staffId: string;
  staffName: string;
  staffEmployeeCode: string;
  isPrimary: boolean;
};

// --- Phase 8A: Exams foundation (term / exam / class / schedule) ---

export type ExamTermStatus = "active" | "archived";
export type ExamType = "unit-test" | "weekly-test" | "monthly-test" | "midterm" | "half-yearly" | "annual" | "pre-board" | "board" | "practical" | "oral" | "assignment" | "project" | "internal-assessment" | "custom";
export type ExamStatus = "draft" | "scheduled" | "completed" | "archived";
export type ExamScope = "internal" | "external";
export type ExamMode = "online" | "offline";

export type ExamTermDto = {
  id: string;
  name: string;
  code: string;
  order: number;
  status: ExamTermStatus;
  examCount: number;
};

export type ExamListItemDto = {
  id: string;
  name: string;
  code: string;
  type: ExamType;
  term: { id: string; name: string };
  startsOn: string; // YYYY-MM-DD
  endsOn: string;
  scope: ExamScope;
  mode: ExamMode;
  status: ExamStatus;
  classCount: number;
  scheduleCount: number;
  gradingSchemeId: string | null; // Phase 8C
  gradingSchemeName: string | null;
};

export type ExamDetailDto = ExamListItemDto & {
  description: string | null;
  classes: { id: string; name: string }[];
};

export type ExamScheduleEntryDto = {
  id: string;
  examId: string;
  section: { id: string; name: string; classId: string; className: string };
  subject: { id: string; code: string; name: string; color: string };
  examDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string;
  maxMarks: number;
  passingMarks: number;
  theoryMarks: number;
  practicalMarks: number;
  invigilator: { id: string; employeeCode: string; name: string } | null;
  notes: string | null;
};

// --- Phase 8B: Marks entry ---
// A row's status is authoritative over its numeric fields: ABSENT/EXEMPT/PENDING
// always carry null marks (absence is never represented as zero). Component caps
// (theoryMarks/practicalMarks/maxMarks) come from the ExamScheduleEntry snapshot
// echoed on `entry` below — never re-derive them from the live Subject.

export type ExamMarkSheetStatus = "draft" | "submitted" | "verified";
export type ExamMarkStatus = "pending" | "marked" | "absent" | "exempt";

export type ExamMarksRosterStudentDto = {
  studentId: string;
  enrollmentId: string | null;
  admissionNumber: string;
  rollNumber: string | null;
  name: string;
  /** False when the student no longer has an active Enrollment in this section but has a historical mark — kept visible, never dropped. */
  currentlyEnrolled: boolean;
  status: ExamMarkStatus;
  theoryMarks: number | null;
  practicalMarks: number | null;
  marksObtained: number | null;
  remarks: string | null;
  enteredByName: string | null;
  enteredAt: string | null; // ISO
};

export type ExamMarksRosterDto = {
  examId: string;
  entry: {
    id: string;
    examDate: string;
    startTime: string;
    endTime: string;
    section: { id: string; name: string; classId: string; className: string };
    subject: { id: string; code: string; name: string; color: string };
    maxMarks: number;
    passingMarks: number;
    theoryMarks: number;
    practicalMarks: number;
  };
  sheet: {
    id: string;
    status: ExamMarkSheetStatus;
    submittedByName: string | null;
    submittedAt: string | null;
    verifiedByName: string | null;
    verifiedAt: string | null;
  };
  students: ExamMarksRosterStudentDto[];
  summary: { totalStudents: number; enteredCount: number; pendingCount: number; absentCount: number; exemptCount: number };
  /** Server-evaluated for the calling actor — the UI never re-derives these client-side. */
  canEnter: boolean;
  canVerify: boolean;
};

/** Lightweight per-paper row for the Marks hub / verification list — no student-level detail. */
export type ExamMarksSummaryItemDto = {
  entryId: string;
  examId: string;
  examName: string;
  examDate: string;
  section: { id: string; name: string; classId: string; className: string };
  subject: { id: string; code: string; name: string; color: string };
  sheetStatus: ExamMarkSheetStatus;
  totalStudents: number;
  enteredCount: number;
};

// --- Phase 8C: Results & Grading ---
// Results are DERIVED from Phase 8B ExamMark (VERIFIED sheets only) — never a
// second editable marks store. Before publication every value below is a live
// preview (`published: false`); after publication it is an immutable snapshot
// frozen at publish time, including the exact grading bands used, so a later
// grading-scheme edit can never change a historical result.

export type GradingSchemeStatus = "active" | "archived";

export type GradingBandDto = {
  id: string;
  label: string;
  minPercent: number;
  maxPercent: number;
  isPass: boolean;
  color: string;
  order: number;
};

export type GradingSchemeDto = {
  id: string;
  name: string;
  status: GradingSchemeStatus;
  bands: GradingBandDto[];
  examCount: number;
};

/** Per-paper status: the 4 real ExamMark statuses, plus "unverified" for a
 *  paper whose ExamMarkSheet exists but hasn't reached VERIFIED yet. */
export type ExamResultMarkStatus = ExamMarkStatus | "unverified";
export type ExamResultPassStatus = "pass" | "fail" | "absent" | "exempt" | "incomplete";
export type ExamResultStatus = "pass" | "fail" | "absent" | "incomplete";

export type ExamSubjectResultDto = {
  examScheduleEntryId: string;
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  maxMarks: number;
  passingMarks: number;
  markStatus: ExamResultMarkStatus;
  theoryMarks: number | null;
  practicalMarks: number | null;
  marksObtained: number | null;
  percentage: number | null;
  grade: string | null;
  passStatus: ExamResultPassStatus;
};

export type StudentExamResultDto = {
  studentId: string;
  enrollmentId: string | null;
  admissionNumber: string;
  rollNumber: string | null;
  name: string;
  totalMaxMarks: number;
  totalMarksObtained: number;
  percentage: number | null;
  grade: string | null;
  status: ExamResultStatus;
  subjects: ExamSubjectResultDto[];
};

export type ExamResultsDto = {
  examId: string;
  published: boolean;
  publishedAt: string | null;
  publishedByName: string | null;
  gradingSchemeId: string | null;
  gradingSchemeName: string | null;
  studentCount: number;
  incompleteCount: number;
  students: StudentExamResultDto[];
};

// --- Phase 8D: Report Cards — a PRESENTATION of an already-published,
// immutable StudentExamResult snapshot. No recomputation, no second result
// engine: every field here is either read straight off the snapshot row or is
// safe, non-academic display metadata (student name, school branding). Rank
// and GPA/CGPA stay deferred (Phase 8C never computed them); attendance and
// teacher/principal remarks stay deferred (no real date-scope / workflow
// backing yet) rather than being fabricated. ---

export type ReportCardExamSummaryDto = {
  examId: string;
  examName: string;
  examCode: string;
  termName: string;
  startsOn: string; // YYYY-MM-DD
  endsOn: string;
  publishedAt: string;
  publishedByName: string | null;
  studentCount: number;
};

export type ReportCardRosterEntryDto = {
  studentId: string;
  admissionNumber: string;
  rollNumber: string | null;
  name: string;
  className: string | null;
  sectionName: string | null;
  totalMaxMarks: number;
  totalMarksObtained: number;
  percentage: number | null;
  grade: string | null;
  status: ExamResultStatus;
};

export type ReportCardDto = {
  exam: { id: string; name: string; code: string; type: ExamType; startsOn: string; endsOn: string; term: { id: string; name: string } };
  publishedAt: string;
  publishedByName: string | null;
  school: { name: string; logoUrl: string | null };
  student: { id: string; name: string; admissionNumber: string; rollNumber: string | null };
  classContext: { className: string | null; sectionName: string | null };
  subjects: ExamSubjectResultDto[];
  summary: { totalMaxMarks: number; totalMarksObtained: number; percentage: number | null; grade: string | null; status: ExamResultStatus };
};

export type ExamMarksSaveRecord = {
  studentId: string;
  status: ExamMarkStatus;
  theoryMarks?: number | null;
  practicalMarks?: number | null;
  marksObtained?: number | null;
  remarks?: string | null;
};

// --- Phase 7: Timetable ---

export type Weekday = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
export type PeriodType = "teaching" | "break";

export type TimetablePeriodDto = {
  id: string;
  name: string;
  periodNumber: number;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  startMinutes: number;
  endMinutes: number;
  type: PeriodType;
  order: number;
};

export type TimetableEntryDto = {
  id: string;
  weekday: Weekday;
  periodId: string;
  section: { id: string; name: string; classId: string; className: string };
  subject: { id: string; code: string; name: string; color: string };
  staff: { id: string; employeeCode: string; name: string };
  teachingAssignmentId: string;
  notes: string | null;
};

/** Grid-friendly section timetable: the bell columns, the weekdays, and entries. */
export type SectionTimetableDto = {
  section: { id: string; name: string; classId: string; className: string };
  weekdays: Weekday[];
  periods: TimetablePeriodDto[];
  entries: TimetableEntryDto[];
};

export type TeacherTimetableDto = {
  staff: { id: string; employeeCode: string; name: string };
  weekdays: Weekday[];
  periods: TimetablePeriodDto[];
  entries: TimetableEntryDto[];
};

// --- Phase 5: Attendance ---

export type AttendanceSummaryDto = {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  halfDay: number;
  medicalLeave: number;
  officialDuty: number;
  attendancePercentage: number | null; // null when total = 0
};

export type AttendanceRosterEntryDto = {
  studentId: string;
  enrollmentId: string;
  name: string;
  admissionNumber: string;
  rollNumber: string | null;
  status: string | null; // present|absent|late|excused|half-day|medical-leave|official-duty, or null (unmarked)
  remarks: string | null;
};

/** Period-attendance lesson context (from the AttendanceSession snapshot). */
export type AttendanceLessonDto = {
  timetableEntryId: string | null;
  subject: { id: string | null; code: string | null; name: string | null };
  period: { id: string | null; name: string | null };
  teacher: { id: string | null; name: string | null };
};

export type AttendanceSessionDto = {
  id: string;
  date: string; // YYYY-MM-DD
  type: "daily" | "period"; // Phase 7C
  status: string; // draft | submitted | locked
  class: { id: string; name: string };
  section: { id: string; name: string };
  markedByName: string | null;
  submittedAt: string | null;
  lockedAt: string | null;
  summary: AttendanceSummaryDto;
  lesson?: AttendanceLessonDto; // present when type === "period"
};

export type AttendanceSessionViewDto = {
  session: AttendanceSessionDto | null; // null when no session exists yet for section+date
  date: string;
  type: "daily" | "period";
  class: { id: string; name: string };
  section: { id: string; name: string };
  roster: AttendanceRosterEntryDto[];
  summary: AttendanceSummaryDto;
  lesson?: AttendanceLessonDto; // present for a period view
};

/** One scheduled teaching lesson available for period attendance on a given date. */
export type PeriodLessonDto = {
  timetableEntryId: string;
  weekday: Weekday;
  period: { id: string; name: string; startTime: string; endTime: string };
  subject: { id: string; code: string; name: string; color: string };
  teacher: { id: string; employeeCode: string; name: string };
  /** The period AttendanceSession already opened for this lesson+date, if any. */
  sessionId: string | null;
  status: string | null; // draft | submitted | locked | null
};

export type AttendanceHistoryItemDto = AttendanceSessionDto;

export type StudentAttendanceEntryDto = {
  date: string;
  status: string;
  remarks: string | null;
  section: { id: string; name: string };
  className: string;
};

export type StudentAttendanceSummaryDto = {
  summary: AttendanceSummaryDto & { records: number };
  recent: StudentAttendanceEntryDto[];
};

// --- Phase 5B: Attendance dashboard + reports (real, PostgreSQL-backed) ---

/**
 * Effective attendance policy for the current school. In Phase 5B these are
 * read-only server defaults (see lib/server/attendance/reports.ts). Persistent,
 * school-configurable Attendance Rules are deferred to a settings phase.
 */
export type AttendancePolicyDto = {
  shortageThresholdPct: number; // a student below this % is flagged as attendance-shortage
  consecutiveAbsenceThreshold: number; // consecutive absent days before a student is at-risk
};

export type AttendanceDashboardDto = {
  date: string; // school-local today (YYYY-MM-DD), server-derived
  presentTodayPct: number | null; // canonical % over today's marked records (null = nothing marked)
  lateToday: number; // LATE records marked today
  belowMinimumCount: number; // active-roster students whose session % < shortage threshold
  consecutiveAbsenceRiskCount: number; // students with an absent streak ≥ threshold
  totalSections: number; // eligible sections (active, ≥1 enrolled student)
  markedSections: number; // eligible sections with a submitted/locked session today
  pendingSections: number; // totalSections − markedSections
  policy: AttendancePolicyDto;
};

export type AttendanceReportType =
  | "daily"
  | "monthly-trend"
  | "class"
  | "shortage"
  | "late-arrival"
  | "consecutive-absence";

// A report is a generic, display-shaped table computed entirely server-side
// (all percentages via the canonical Phase 5 summary formula). The page renders
// `columns` in order and reads each value out of the row by column key.
export type AttendanceReportRow = Record<string, string | number>;
export type AttendanceReportDto = {
  type: AttendanceReportType | string; // daily report types + Phase-7C period report types
  columns: string[];
  rows: AttendanceReportRow[];
  threshold: number | null; // shortage/consecutive-absence policy value in effect, else null
};

// --- Super Admin: real platform permission matrix (reference page) ---

export type PlatformPermissionMatrixDto = {
  roles: { key: string; label: string }[];
  areas: { key: string; label: string }[];
  matrix: Record<string, Record<string, "manage" | "view" | null>>;
};
