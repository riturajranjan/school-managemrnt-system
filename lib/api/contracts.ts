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
  adminPasswordSetupUrl: string | null;
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
  designation: string | null; // display cache — see departmentId/designationId for the real relationship authority (Phase 9P)
  department: string | null;
  departmentId: string | null;
  designationId: string | null;
  employmentType: EmploymentType | null;
  isTeaching: boolean;
  status: StaffStatus;
  branchId: string;
  email: string | null;
  hasUser: boolean; // whether a login account is linked (id never exposed in list)
  /** Real reporting-line relationship (production migration, Phase B) — the org chart derives its hierarchy from this. */
  reportsToStaffId: string | null;
  reportsToName: string | null;
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

/** One teaching assignment from a Staff/teacher's own perspective — real Section + Subject. */
export type StaffTeachingAssignmentDto = {
  id: string;
  isPrimary: boolean;
  section: { id: string; name: string; classId: string; className: string };
  subject: { id: string; code: string; name: string; color: string };
};

/** Bulk per-staff teaching-load aggregate (Phase 9J, Teachers directory list) — real TeachingAssignment + TimetableEntry counts, never fabricated workload. */
export type TeachingLoadSummaryDto = {
  staffId: string;
  subjects: { id: string; name: string; shortName: string }[];
  sectionCount: number;
  weeklyPeriods: number; // count of this staff's real TimetableEntry rows in the current academic session
};

/**
 * Teacher detail aggregation (Phase 9J) — one server round-trip over the
 * existing real domains for a single Staff member, in place of the page doing
 * several separate fetches. Each section is `null` when the caller lacks the
 * underlying domain permission (never partially fabricated) — for `attendance`
 * specifically, also when the caller may not view this staff's attendance
 * (self, or a broad staff-attendance manager, only — see staff-attendance
 * service `assertCanViewStaff`). `payroll` never carries an amount — Staff/
 * Teacher surfaces link to Payroll, they do not duplicate its figures.
 */
export type TeacherDetailDto = {
  staff: StaffDetailDto;
  teachingAssignments: StaffTeachingAssignmentDto[];
  timetable: TeacherTimetableDto | null;
  homework: { items: HomeworkListItemDto[]; total: number } | null;
  lessonPlans: { items: LessonPlanListItemDto[]; total: number } | null;
  attendance: StaffAttendancePercentDto | null;
  leave: { pendingCount: number; items: LeaveRequestDto[] } | null;
  payroll: { visible: boolean };
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

// --- Phase 8E: Promotion / Academic-Year Transition — PASS/FAIL is an exam
// result, never an automatic promotion decision. A row only exists once
// PROMOTED or RETAINED is finalized; "pending" is the absence of a row for a
// given (student, fromSession, toSession) transition, computed server-side. ---

export type PromotionDecisionDto = "promoted" | "retained";

/** Why a candidate can/can't be processed right now — real facts only, never
 *  an invented policy (no attendance/fees/grace-marks/rank/GPA rule). */
export type PromotionEligibilityStateDto =
  | "ready"
  | "blocked_result_unpublished"
  | "blocked_result_incomplete" // exam published, but no result row exists for this student
  | "already_processed"
  | "no_current_enrollment"
  | "target_not_configured"; // frontend-only: no target class/section chosen yet

export type PromotionCandidateDto = {
  student: { id: string; name: string; admissionNumber: string; rollNumber: string | null };
  currentEnrollment: { id: string; classId: string; className: string; sectionId: string; sectionName: string } | null;
  result: { studentExamResultId: string; status: ExamResultStatus; percentage: number | null; grade: string | null } | null;
  eligibility: { state: PromotionEligibilityStateDto; reasons: string[] };
  existingPromotion: PromotionListItemDto | null;
};

export type PromotionListItemDto = {
  id: string;
  student: { id: string; name: string; admissionNumber: string };
  fromSession: { id: string; name: string };
  toSession: { id: string; name: string };
  fromClassName: string | null;
  fromSectionName: string | null;
  decision: PromotionDecisionDto;
  targetClass: { id: string; name: string };
  targetSection: { id: string; name: string };
  sourceExamId: string;
  notes: string | null;
  processedAt: string;
  processedByName: string | null;
};

export type ProcessPromotionRequest = {
  studentId: string;
  sourceStudentResultId: string;
  targetAcademicSessionId: string;
  decision: PromotionDecisionDto;
  targetClassId: string;
  targetSectionId: string;
  notes?: string;
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

// --- Phase 9A: Teacher Experience Foundation (Main Dashboard + My Day) ---
// Every field here is either read straight off a real table or derived by an
// existing canonical service (attendance dashboard, marks summary, timetable).
// No AI/insight generation, no composite "pulse" score, no fabricated homework/
// lesson-plan/notification/calendar counts — those stay explicitly unavailable
// until their own domain is real (see the `available: false` shapes below).

export type CurrentStaffDto = {
  id: string;
  employeeCode: string;
  name: string;
  designation: string | null;
  isTeaching: boolean;
};

/** A real scheduled lesson (TimetableEntry) with its historical class/section/
 *  subject context, plus — for My Day only — the real attendance action state
 *  for that specific lesson (from the PERIOD AttendanceSession tied to it). */
export type MyDayTimetableEntryDto = {
  timetableEntryId: string;
  weekday: Weekday;
  period: { id: string; name: string; startTime: string; endTime: string };
  section: { id: string; name: string; classId: string; className: string };
  subject: { id: string; code: string; name: string; color: string };
  attendance: { sessionId: string | null; status: "not_marked" | "draft" | "submitted" | "locked" };
};

/** A pending mark-entry task: a real ExamScheduleEntry this teacher owns
 *  (via TeachingAssignment) whose ExamMarkSheet isn't VERIFIED yet. */
export type MyDayMarksActionDto = {
  entryId: string;
  examId: string;
  examName: string;
  examDate: string; // YYYY-MM-DD
  section: { id: string; name: string; classId: string; className: string };
  subject: { id: string; code: string; name: string; color: string };
  sheetStatus: ExamMarkSheetStatus; // "draft" | "submitted" — never "verified" (excluded)
  totalStudents: number;
  enteredCount: number;
};

export type UpcomingExamDto = {
  examId: string;
  examName: string;
  examDate: string; // YYYY-MM-DD — the earliest real ExamScheduleEntry date for this exam within the filter
  termName: string;
  section: { id: string; name: string; classId: string; className: string } | null; // null when school-wide (admin view spans many sections)
  subject: { id: string; code: string; name: string; color: string } | null;
};

// --- Phase 9B: Homework / Assignments — one Homework targets exactly one
// real Section; teacher authorship is a real Staff + TeachingAssignment for
// (sectionId, subjectId). Submissions/grading/attachments/parent
// acknowledgement are deliberately not modeled (see prisma/schema.prisma's
// Homework doc comment) — no submissionSummary field exists because there is
// nothing real to summarize. ---

export type HomeworkStatusDto = "draft" | "published" | "closed";

export type HomeworkListItemDto = {
  id: string;
  title: string;
  status: HomeworkStatusDto;
  dueAt: string; // YYYY-MM-DD
  section: { id: string; name: string; classId: string; className: string };
  subject: { id: string; code: string; name: string; color: string };
  teacher: { id: string; name: string };
  studentCount: number; // real, from Enrollment(status=ENROLLED) in the section
  createdAt: string;
  updatedAt: string;
};

export type HomeworkDetailDto = HomeworkListItemDto & {
  description: string;
  instructions: string | null;
};

export type CreateHomeworkRequest = {
  sectionId: string;
  subjectId: string;
  title: string;
  description: string;
  instructions?: string;
  dueAt: string; // YYYY-MM-DD
};

export type UpdateHomeworkRequest = {
  title?: string;
  description?: string;
  instructions?: string | null;
  dueAt?: string; // YYYY-MM-DD
};

/** A real (section, subject) the actor may create homework for — their own
 *  real TeachingAssignment, never an arbitrary/offered-but-unassigned pair. */
export type AssignableTeachingDto = {
  teachingAssignmentId: string;
  section: { id: string; name: string; classId: string; className: string };
  subject: { id: string; code: string; name: string; color: string };
};

// --- Phase 9C.1: Curriculum / Syllabus Tracking — content (Curriculum -> Unit
// -> Chapter -> Topic) authored once per (Class, Subject, AcademicSession).
// Unit/Chapter carry no persisted status/percentage — "status"/completion
// counts here are always server-computed from real CurriculumTopicProgress
// rows for whichever Section was requested (or null/zeroed when no section
// context was given, e.g. the content-authoring detail view). ---

export type CurriculumStatusDto = "draft" | "active" | "archived";
export type TopicProgressStatusDto = "not-started" | "in-progress" | "completed";
/** Derived aggregate only — never persisted. "delayed" = plannedEnd has
 *  passed and the unit isn't fully completed (a real date-derived rule, not
 *  an invented state). */
export type CurriculumAggregateStatusDto = "not-started" | "in-progress" | "completed" | "delayed";

export type CurriculumTopicDto = {
  id: string;
  title: string;
  order: number;
  learningOutcomes: string[];
  /** Present only when the request was section-scoped. */
  progress: { status: TopicProgressStatusDto; completedAt: string | null; completedByStaffName: string | null } | null;
};

export type CurriculumChapterDto = {
  id: string;
  title: string;
  order: number;
  status: CurriculumAggregateStatusDto;
  completedTopics: number;
  totalTopics: number;
  topics: CurriculumTopicDto[];
};

export type CurriculumUnitDto = {
  id: string;
  title: string;
  description: string | null;
  order: number;
  plannedStart: string | null; // YYYY-MM-DD
  plannedEnd: string | null; // YYYY-MM-DD
  estimatedPeriods: number;
  status: CurriculumAggregateStatusDto;
  completedTopics: number;
  totalTopics: number;
  chapters: CurriculumChapterDto[];
};

export type CurriculumListItemDto = {
  id: string;
  title: string;
  description: string | null;
  status: CurriculumStatusDto;
  class: { id: string; name: string };
  subject: { id: string; code: string; name: string; color: string };
  unitCount: number;
  topicCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CurriculumDetailDto = CurriculumListItemDto & { units: CurriculumUnitDto[] };

export type CreateCurriculumRequest = { classId: string; subjectId: string; title: string; description?: string };
export type UpdateCurriculumRequest = { title?: string; description?: string };
export type ChangeCurriculumStatusRequest = { status: CurriculumStatusDto };
export type CreateCurriculumUnitRequest = { title: string; description?: string; order?: number; plannedStart?: string; plannedEnd?: string; estimatedPeriods?: number };
export type UpdateCurriculumUnitRequest = Partial<CreateCurriculumUnitRequest>;
export type CreateCurriculumChapterRequest = { title: string; order?: number };
export type UpdateCurriculumChapterRequest = Partial<CreateCurriculumChapterRequest>;
export type CreateCurriculumTopicRequest = { title: string; order?: number; learningOutcomes?: string[] };
export type UpdateCurriculumTopicRequest = Partial<CreateCurriculumTopicRequest>;

/** The full Unit -> Chapter -> Topic tree for one real Section, with per-topic
 *  progress for that section and a real, server-computed overall percentage
 *  (never persisted; null when the curriculum has zero topics — an honest
 *  empty state, not a fake 0%). */
export type SectionCurriculumDto = {
  curriculum: CurriculumListItemDto;
  units: CurriculumUnitDto[];
  overallPercent: number | null;
};

export type UpdateTopicProgressRequest = { status: TopicProgressStatusDto };

/** Real, DB-derived completion rollups for the Curriculum page's "Completion
 *  by class/subject/teacher" panels — averaged across each entity's real
 *  Sections' CurriculumTopicProgress, never a stored/fabricated number. */
export type CurriculumInsightsDto = {
  overallPercent: number | null;
  unitsTracked: number;
  delayedUnits: number;
  classesTracked: number;
  byClass: { classId: string; className: string; percent: number | null }[];
  bySubject: { subjectId: string; subjectName: string; subjectColor: string; percent: number | null }[];
  byTeacher: { staffId: string; staffName: string; percent: number | null }[];
};

// --- Phase 9C.2: Lesson Plans — a real teaching plan for one Staff teacher's
// TeachingAssignment on one date, optionally mapped to real CurriculumTopic
// row(s). Preserves the existing draft -> submitted -> approved/rejected ->
// completed review workflow, collapsed to the states the real UI drives. ---

export type LessonPlanStatusDto = "draft" | "submitted" | "approved" | "rejected" | "completed";

export type LessonPlanListItemDto = {
  id: string;
  title: string;
  status: LessonPlanStatusDto;
  plannedDate: string; // YYYY-MM-DD
  period: number | null;
  section: { id: string; name: string; classId: string; className: string };
  subject: { id: string; code: string; name: string; color: string };
  teacher: { id: string; name: string };
  learningObjective: string;
  topicCount: number;
  createdAt: string;
  updatedAt: string;
};

export type LessonPlanDetailDto = LessonPlanListItemDto & {
  teachingMethod: string;
  materials: string | null;
  activity: string | null;
  homeworkNote: string | null;
  assessmentMethod: string | null;
  reviewComment: string | null;
  reviewedByName: string | null;
  topics: { id: string; title: string; chapterTitle: string; unitTitle: string }[];
};

export type CreateLessonPlanRequest = {
  sectionId: string;
  subjectId: string;
  title: string;
  learningObjective: string;
  teachingMethod: string;
  materials?: string;
  activity?: string;
  homeworkNote?: string;
  assessmentMethod?: string;
  plannedDate: string; // YYYY-MM-DD
  period?: number;
  topicIds?: string[];
};

export type UpdateLessonPlanRequest = {
  title?: string;
  learningObjective?: string;
  teachingMethod?: string;
  materials?: string;
  activity?: string;
  homeworkNote?: string;
  assessmentMethod?: string;
  plannedDate?: string;
  period?: number;
  topicIds?: string[];
};

// --- Phase 9D.1: Academic Calendar — real manual CalendarEvent rows, merged
// at query time with events DERIVED live from Exam schedule/Homework due
// dates/Lesson Plan planned dates. Derived occurrences are never persisted;
// they're identified by (sourceType, sourceId) instead of a CalendarEvent id
// so they can never drift from their own source-of-truth table. ---

export type CalendarEventTypeDto = "holiday" | "meeting" | "ptm" | "celebration" | "activity" | "deadline" | "other";
export type CalendarAudienceDto = "all" | "teachers";
export type CalendarRecurrenceDto = "none" | "weekly" | "yearly";
export type CalendarSourceTypeDto = "manual" | "exam" | "homework" | "lesson-plan" | "activity-event";

export type CalendarEventDto = {
  id: string;
  sourceType: CalendarSourceTypeDto;
  sourceId: string; // CalendarEvent.id for manual rows, the source row's id otherwise
  title: string;
  description: string | null;
  type: CalendarEventTypeDto;
  audience: CalendarAudienceDto;
  startDate: string; // YYYY-MM-DD
  endDate: string | null;
  allDay: boolean;
  recurring: CalendarRecurrenceDto;
  location: string | null;
  createdBy: string | null;
  editable: boolean; // false for derived occurrences — edit at the source (Exams/Homework/Lesson Plans)
};

export type CreateCalendarEventRequest = {
  title: string;
  description?: string;
  type: CalendarEventTypeDto;
  audience?: CalendarAudienceDto;
  startDate: string; // YYYY-MM-DD
  endDate?: string;
  allDay?: boolean;
  recurring?: CalendarRecurrenceDto;
  recurrenceUntil?: string;
  location?: string;
};

export type UpdateCalendarEventRequest = Partial<CreateCalendarEventRequest>;

// --- Phase 9D.2: In-app Notifications — real Notification + per-recipient
// NotificationRecipient rows. V1 is in-app only (no email/SMS/push). ---

export type NotificationTypeDto = "lesson-plan-approved" | "lesson-plan-rejected" | "exam-scheduled" | "calendar-event" | "leave-request-submitted" | "leave-request-approved" | "leave-request-rejected" | "visitor-checked-in" | "message-received" | "library-book-issued" | "library-book-returned" | "asset-assigned" | "asset-returned" | "counseling-case-assigned" | "activity-staff-assigned" | "transport-alert";

export type NotificationDto = {
  id: string;
  type: NotificationTypeDto;
  title: string;
  body: string;
  href: string | null;
  createdAt: string;
  readAt: string | null;
};

// --- Phase 9K: Communication / Messaging — real User-to-User conversations.
// User.id is the canonical messaging identity (never Staff.id, never a name
// string). Student/Guardian have no linked User account yet, so they never
// appear as recipients/participants — a real limitation, not an oversight. ---

export type ConversationTypeDto = "direct" | "group";

/** A real, eligible messaging recipient — either a Staff-linked User or a
 * non-Staff privileged User (e.g. a school admin with no Staff row). Never a
 * Student/Guardian (no real User account exists for them). */
export type MessagingRecipientDto = {
  userId: string;
  displayName: string;
  roleLabel: string | null;
  staffId: string | null;
};

export type ConversationListItemDto = {
  id: string;
  type: ConversationTypeDto;
  title: string;
  lastMessage: { body: string; createdAt: string; senderName: string; fromMe: boolean } | null;
  unreadCount: number;
  updatedAt: string;
};

export type ConversationDetailDto = ConversationListItemDto & {
  participants: { userId: string; displayName: string }[];
};

export type MessageDto = {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderName: string;
  fromMe: boolean;
  body: string;
  createdAt: string;
};

export type MessageHistoryDto = {
  items: MessageDto[];
  nextCursor: string | null;
};

export type StartDirectConversationRequest = { recipientUserId: string };
export type SendMessageRequest = { body: string };

// --- Phase 9L: Action Inbox — derived, never persisted. Every item is
// computed live from an existing real domain's own status/lifecycle (no
// second ActionItem table, no second workflow). `id` is deterministic:
// `<sourceType>:<sourceId>:<actionKind>`. `dueAt`/`priority` only ever come
// from a real domain field — never fabricated. ---

export type ActionCategoryDto = "lesson_plan" | "leave" | "marks" | "fees" | "payroll" | "visitor" | "communication" | "library" | "inventory";
export type ActionPriorityDto = "urgent" | "high" | "normal" | "low";

export type ActionItemDto = {
  id: string;
  sourceType: string;
  sourceId: string;
  category: ActionCategoryDto;
  title: string;
  description: string;
  priority: ActionPriorityDto;
  createdAt: string;
  dueAt: string | null;
  href: string;
  actionLabel: string;
  status: string;
};

export type ActionInboxSummaryDto = {
  total: number;
  byPriority: Record<ActionPriorityDto, number>;
  byCategory: Record<ActionCategoryDto, number>;
};

// --- Phase 9E.1: Staff Attendance — real StaffAttendanceRecord, one row per
// staff per day. A staff member with no row for a date is NOT_MARKED (never
// synthesized as absent). ---

export type StaffAttendanceStatusDto = "present" | "absent" | "late" | "half-day" | "on-leave";
export type EffectiveStaffAttendanceStatusDto = StaffAttendanceStatusDto | "not-marked";

export type StaffAttendanceRosterEntryDto = {
  staffId: string;
  name: string;
  employeeCode: string;
  designation: string | null;
  department: string | null;
  status: EffectiveStaffAttendanceStatusDto;
  checkInAt: string | null; // HH:MM
  checkOutAt: string | null; // HH:MM
  notes: string | null;
  recordId: string | null; // null when NOT_MARKED — nothing to correct yet
};

export type StaffAttendanceSummaryDto = {
  date: string; // YYYY-MM-DD
  totalActiveStaff: number;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  onLeave: number;
  notMarked: number;
};

export type MarkStaffAttendanceRequest = {
  date: string; // YYYY-MM-DD
  entries: { staffId: string; status: StaffAttendanceStatusDto; checkInAt?: string; checkOutAt?: string; notes?: string; override?: boolean }[];
};

export type StaffAttendanceHistoryEntryDto = {
  id: string;
  date: string;
  status: StaffAttendanceStatusDto;
  checkInAt: string | null;
  checkOutAt: string | null;
  notes: string | null;
  markedByName: string | null;
};

/** null when the staff member has zero attendance rows in range — never fake 0%. */
export type StaffAttendancePercentDto = { presentDays: number; countedDays: number; percentage: number | null };

// --- Phase 9E.2: Leave Management — real LeaveType + LeaveRequest.
// LeaveRequest is the sole authority for staff leave; approving one writes
// ON_LEAVE onto StaffAttendanceRecord for the covered dates (never the
// reverse). ---

export type LeaveTypeStatusDto = "active" | "inactive";

export type LeaveTypeDto = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  isPaid: boolean;
  status: LeaveTypeStatusDto;
};

export type CreateLeaveTypeRequest = { name: string; code: string; description?: string; isPaid?: boolean };
export type UpdateLeaveTypeRequest = { name?: string; description?: string; isPaid?: boolean; status?: LeaveTypeStatusDto };

export type LeaveRequestStatusDto = "pending" | "approved" | "rejected" | "cancelled";

export type LeaveRequestDto = {
  id: string;
  staffId: string;
  staffName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  halfDay: boolean;
  reason: string;
  status: LeaveRequestStatusDto;
  requestedAt: string;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
};

export type CreateLeaveRequestRequest = { staffId?: string; leaveTypeId: string; startDate: string; endDate: string; halfDay?: boolean; reason: string };
export type RejectLeaveRequestRequest = { reviewNote: string };

// --- Phase 9F: Fees & Collections. Money is a plain number in every DTO —
// always Decimal-derived server-side (lib/server/fees/money.ts), never
// client arithmetic authority. See lib/server/fees/balance.ts for the one
// canonical charge-balance formula every screen below reads through. ---

export type FeeCategoryStatusDto = "active" | "archived";
export type FeeCategoryDto = { id: string; name: string; code: string; description: string | null; status: FeeCategoryStatusDto };
export type CreateFeeCategoryRequest = { name: string; code: string; description?: string };
export type UpdateFeeCategoryRequest = { name?: string; description?: string; status?: FeeCategoryStatusDto };

export type FeeStructureStatusDto = "draft" | "active" | "archived";
export type FeeStructureItemDto = { id: string; categoryId: string; categoryName: string; name: string | null; amount: number; dueDate: string; order: number };
export type FeeStructureListItemDto = { id: string; name: string; academicSessionId: string; status: FeeStructureStatusDto; currency: string; totalAmount: number; classIds: string[]; classNames: string[] };
export type FeeStructureDetailDto = FeeStructureListItemDto & { description: string | null; items: FeeStructureItemDto[] };
export type CreateFeeStructureRequest = {
  name: string;
  description?: string;
  classIds: string[];
  items: { categoryId: string; name?: string; amount: number; dueDate: string; order?: number }[];
};
export type UpdateFeeStructureRequest = Partial<Omit<CreateFeeStructureRequest, "classIds" | "items">> & { classIds?: string[]; items?: CreateFeeStructureRequest["items"] };

export type FeeAssignmentTargetDto = { type: "student"; studentId: string } | { type: "section"; sectionId: string } | { type: "class"; classId: string };
export type AssignFeeStructureRequest = { feeStructureId: string; target: FeeAssignmentTargetDto };
export type AssignFeeStructureResultDto = { assigned: number; alreadyAssigned: number; ineligible: { studentId: string; reason: string }[] };

export type FeeChargeStatusDto = "unpaid" | "partially_paid" | "paid" | "overdue";
export type FeeChargeDto = {
  id: string;
  studentId: string;
  categoryName: string;
  itemName: string | null;
  dueDate: string;
  billedAmount: number;
  discountAmount: number;
  scholarshipAmount: number;
  lateFeeAmount: number;
  netAmount: number;
  paidAmount: number;
  balance: number;
  status: FeeChargeStatusDto;
};

export type FeeAdjustmentKindDto = "discount" | "scholarship" | "late_fee";
export type FeeAdjustmentAmountTypeDto = "fixed" | "percentage";
export type FeeAdjustmentDto = {
  id: string;
  chargeId: string;
  kind: FeeAdjustmentKindDto;
  amountType: FeeAdjustmentAmountTypeDto;
  value: number;
  computedAmount: number;
  reason: string;
  appliedByName: string | null;
  createdAt: string;
};
export type ApplyFeeAdjustmentRequest = { chargeId: string; kind: FeeAdjustmentKindDto; amountType: FeeAdjustmentAmountTypeDto; value: number; reason: string };

export type FeePaymentMethodDto = "cash" | "upi" | "card" | "bank_transfer" | "cheque" | "other";
export type FeeReconciliationStatusDto = "unreconciled" | "reconciled" | "mismatch";
export type FeePaymentAllocationDto = { chargeId: string; categoryName: string; itemName: string | null; amount: number };
export type FeePaymentDto = {
  id: string;
  receiptNumber: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  className: string | null;
  sectionName: string | null;
  amount: number;
  currency: string;
  method: FeePaymentMethodDto;
  paymentDate: string;
  reference: string | null;
  chequeNumber: string | null;
  chequeDate: string | null;
  bankName: string | null;
  notes: string | null;
  receivedByName: string | null;
  reconciliationStatus: FeeReconciliationStatusDto;
  reconciledByName: string | null;
  reconciledAt: string | null;
  reconciliationNote: string | null;
  allocations: FeePaymentAllocationDto[];
  refundedAmount: number;
  createdAt: string;
};
export type RecordFeePaymentRequest = {
  studentId: string;
  allocations: { chargeId: string; amount: number }[];
  method: FeePaymentMethodDto;
  paymentDate?: string;
  reference?: string;
  chequeNumber?: string;
  chequeDate?: string;
  bankName?: string;
  notes?: string;
};

export type FeeRefundDto = { id: string; paymentId: string; amount: number; reason: string; refundedByName: string | null; refundedAt: string };
export type FeeRefundListItemDto = FeeRefundDto & { receiptNumber: string; studentName: string };
export type CreateFeeRefundRequest = { amount: number; reason: string };

export type ReconcilePaymentRequest = { status: "reconciled" | "mismatch"; note?: string };

export type StudentFeeLedgerDto = {
  studentId: string;
  assignments: { id: string; feeStructureId: string; feeStructureName: string; status: "active" | "withdrawn"; assignedAt: string }[];
  charges: FeeChargeDto[];
  payments: FeePaymentDto[];
  totals: { billed: number; adjustments: number; paid: number; balance: number };
};

export type StudentDuesRowDto = {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  className: string | null;
  sectionName: string | null;
  outstanding: number;
  overdue: number;
  oldestOverdueDays: number;
};
export type DuesAgingBucketDto = { bucket: "current" | "1-15" | "16-30" | "31-60" | "61-90" | "90-plus"; amount: number; count: number };
export type DuesSummaryDto = {
  totalOutstanding: number;
  totalOverdue: number;
  dueThisWeek: number;
  dueThisMonth: number;
  studentsOverdue: number;
  aging: DuesAgingBucketDto[];
};

export type FeeReminderCandidateDto = {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  overdueAmount: number;
  oldestOverdueDays: number;
  guardianName: string | null;
  guardianPhone: string | null;
  deliverable: false; // Student/Guardian have no linked User account — always false, see lib/server/fees/reminders.ts
};

export type FeeCollectionReportDto = {
  totalCollected: number;
  byMethod: { method: FeePaymentMethodDto; amount: number; count: number }[];
  byCategory: { categoryName: string; amount: number }[];
  byDay: { date: string; amount: number }[];
};
export type FeeOutstandingReportDto = { totalOutstanding: number; totalOverdue: number; byClass: { classId: string; className: string; outstanding: number; overdue: number }[] };
export type FeeAdjustmentReportDto = { totalDiscounts: number; totalScholarships: number; totalLateFees: number; count: number };
export type FeeRefundReportDto = { totalRefunded: number; count: number };
export type FeeReconciliationReportDto = { unreconciled: number; reconciled: number; mismatch: number; unreconciledAmount: number };

export type FeeDashboardDto = { collectedToday: number; outstanding: number; overdue: number; collectedThisMonth: number };

// --- Phase 9G: Accounting / General Ledger. Money is a plain number,
// always Prisma.Decimal-derived server-side (lib/server/fees/money.ts's
// dec() helper, reused as-is). CASH basis — see the schema doc comment on
// AccountingAccount for the full policy. ---

export type AccountingAccountTypeDto = "asset" | "liability" | "equity" | "income" | "expense";
export type AccountingAccountStatusDto = "active" | "archived";
export type AccountingAccountDto = {
  id: string;
  code: string;
  name: string;
  type: AccountingAccountTypeDto;
  parentId: string | null;
  description: string | null;
  status: AccountingAccountStatusDto;
  systemKey: string | null;
  balance: number;
};
export type CreateAccountingAccountRequest = { code: string; name: string; type: AccountingAccountTypeDto; parentId?: string; description?: string };
export type UpdateAccountingAccountRequest = { name?: string; description?: string; parentId?: string | null; status?: AccountingAccountStatusDto };

export type JournalEntryStatusDto = "draft" | "posted" | "reversed";
export type JournalSourceTypeDto = "manual" | "fee_payment" | "fee_refund" | "payroll_payment" | "staff_advance_disbursement" | "staff_advance_repayment";
export type JournalLineDto = { id: string; accountId: string; accountCode: string; accountName: string; debit: number; credit: number; description: string | null };
export type JournalEntryListItemDto = {
  id: string;
  entryNumber: string;
  entryDate: string;
  description: string;
  status: JournalEntryStatusDto;
  sourceType: JournalSourceTypeDto;
  sourceId: string | null;
  totalAmount: number; // sum of debits (== sum of credits once posted)
  reversalOfId: string | null;
  isReversed: boolean; // true if some other entry reverses this one
};
export type JournalEntryDetailDto = JournalEntryListItemDto & { lines: JournalLineDto[]; createdByName: string | null; postedAt: string | null };
export type CreateJournalEntryRequest = { entryDate: string; description: string; lines: { accountId: string; debit?: number; credit?: number; description?: string }[] };
export type ReverseJournalEntryRequest = { reason: string };

export type LedgerEntryDto = {
  id: string;
  journalEntryId: string;
  entryNumber: string;
  entryDate: string;
  description: string;
  sourceType: JournalSourceTypeDto;
  debit: number;
  credit: number;
  runningBalance: number;
};
export type AccountLedgerDto = { account: AccountingAccountDto; openingBalance: number; entries: LedgerEntryDto[]; closingBalance: number };

export type TrialBalanceRowDto = { accountId: string; code: string; name: string; type: AccountingAccountTypeDto; debit: number; credit: number; balance: number };
export type TrialBalanceDto = { rows: TrialBalanceRowDto[]; totalDebit: number; totalCredit: number; balanced: boolean };

export type IncomeExpenseReportDto = {
  totalIncome: number;
  totalExpense: number;
  netIncome: number;
  incomeByAccount: { accountId: string; name: string; amount: number }[];
  expenseByAccount: { accountId: string; name: string; amount: number }[];
};

export type AccountingDashboardDto = {
  totalIncome: number;
  totalExpense: number;
  netIncome: number;
  cashAndBankBalance: number;
  unreconciledFeeCollections: number; // count, sourced from the real Phase 9F reconciliation status
  recentJournals: JournalEntryListItemDto[];
  trialBalanceOk: boolean; // debits == credits across all POSTED lines
};

// --- Production Accounting checkpoint: Vendors / Purchase Orders / Budgets.
// A PurchaseOrder never produces a JournalEntry (not a payment). A Budget's
// `budgeted` figure is stored; `actual`/`variance` are always derived live
// from POSTED JournalLines, never persisted. ---

export type VendorStatusDto = "active" | "inactive";
export type VendorDto = {
  id: string;
  code: string;
  name: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxId: string | null;
  notes: string | null;
  status: VendorStatusDto;
  createdAt: string;
  updatedAt: string;
};
export type CreateVendorRequest = { code: string; name: string; contactPerson?: string; email?: string; phone?: string; address?: string; taxId?: string; notes?: string };
export type UpdateVendorRequest = { name?: string; contactPerson?: string | null; email?: string | null; phone?: string | null; address?: string | null; taxId?: string | null; notes?: string | null; status?: VendorStatusDto };

export type PurchaseOrderStatusDto = "draft" | "approved" | "cancelled";
export type PurchaseOrderItemDto = { id: string; description: string; quantity: number; unitRate: number; taxPercent: number; lineTotal: number };
export type PurchaseOrderListItemDto = {
  id: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  status: PurchaseOrderStatusDto;
  orderDate: string;
  expectedDeliveryDate: string | null;
  totalAmount: number;
  itemCount: number;
  createdAt: string;
};
export type PurchaseOrderDetailDto = PurchaseOrderListItemDto & {
  vendorCode: string;
  items: PurchaseOrderItemDto[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  notes: string | null;
  createdByName: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  cancelledByName: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
};
export type CreatePurchaseOrderRequest = {
  vendorId: string;
  orderDate: string;
  expectedDeliveryDate?: string;
  notes?: string;
  discountTotal?: number;
  items: { description: string; quantity: number; unitRate: number; taxPercent?: number }[];
};
export type CancelPurchaseOrderRequest = { reason: string };

export type BudgetStatusDto = "draft" | "approved";
export type BudgetAllocationDto = { id: string; accountingAccountId: string; accountCode: string; accountName: string; budgeted: number; actual: number; variance: number };
export type BudgetListItemDto = {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  status: BudgetStatusDto;
  totalBudgeted: number;
  totalActual: number;
  totalVariance: number;
  createdAt: string;
};
export type BudgetDetailDto = BudgetListItemDto & { notes: string | null; allocations: BudgetAllocationDto[]; approvedByName: string | null; approvedAt: string | null };
export type CreateBudgetRequest = { name: string; periodStart: string; periodEnd: string; notes?: string; allocations: { accountingAccountId: string; amount: number }[] };
export type UpdateBudgetAllocationsRequest = { allocations: { accountingAccountId: string; amount: number }[] };

// --- Phase 9H: Payroll ---

export type SalaryComponentTypeDto = "earning" | "deduction";
export type SalaryComponentCalcTypeDto = "fixed" | "percentage";
export type SalaryComponentStatusDto = "active" | "archived";

export type SalaryComponentDto = {
  id: string;
  code: string;
  name: string;
  type: SalaryComponentTypeDto;
  calcType: SalaryComponentCalcTypeDto;
  description: string | null;
  status: SalaryComponentStatusDto;
};

export type CreateSalaryComponentRequest = {
  code: string;
  name: string;
  type: SalaryComponentTypeDto;
  calcType: SalaryComponentCalcTypeDto;
  description?: string;
};
export type UpdateSalaryComponentRequest = { name?: string; description?: string | null; status?: SalaryComponentStatusDto };

export type SalaryStructureStatusDto = "active" | "archived";

export type SalaryStructureComponentLineDto = {
  id: string;
  componentId: string;
  componentCode: string;
  componentName: string;
  type: SalaryComponentTypeDto;
  calcType: SalaryComponentCalcTypeDto;
  amount: number | null;
  percent: number | null;
  percentOfLineId: string | null;
};

export type SalaryStructureListItemDto = {
  id: string;
  name: string;
  description: string | null;
  status: SalaryStructureStatusDto;
  componentCount: number;
  assignmentCount: number; // >0 means structurally locked
};

export type SalaryStructureDetailDto = SalaryStructureListItemDto & {
  components: SalaryStructureComponentLineDto[];
};

export type CreateSalaryStructureComponentInput = { componentId: string; amount?: number; percent?: number; percentOfComponentId?: string };
export type CreateSalaryStructureRequest = { name: string; description?: string; components: CreateSalaryStructureComponentInput[] };
export type UpdateSalaryStructureRequest = { name?: string; description?: string | null; components?: CreateSalaryStructureComponentInput[] };
export type SetSalaryStructureStatusRequest = { status: SalaryStructureStatusDto };

export type StaffSalaryAssignmentDto = {
  id: string;
  staffId: string;
  employeeCode: string;
  staffName: string;
  salaryStructureId: string;
  salaryStructureName: string;
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo: string | null;
  createdByName: string | null;
  createdAt: string;
};
export type CreateStaffSalaryAssignmentRequest = { staffId: string; salaryStructureId: string; effectiveFrom: string; effectiveTo?: string };

export type PayrollRunStatusDto = "draft" | "calculated" | "finalized" | "paid";

export type PayrollRunListItemDto = {
  id: string;
  year: number;
  month: number;
  period: string; // "YYYY-MM"
  status: PayrollRunStatusDto;
  staffCount: number;
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  calculatedAt: string | null;
  finalizedAt: string | null;
  paidAt: string | null;
};

export type PayrollRunItemComponentDto = {
  id: string;
  componentId: string | null;
  componentName: string;
  type: SalaryComponentTypeDto;
  amount: number;
  source: "structure" | "manual";
  manualReason: string | null;
};

export type PayrollRunItemDto = {
  id: string;
  staffId: string;
  employeeCode: string;
  staffName: string;
  salaryStructureId: string | null;
  salaryStructureName: string | null;
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
  attendance: { present: number; absent: number; late: number; halfDay: number; onLeave: number; notMarked: number; paidLeave: number; unpaidLeave: number };
  components: PayrollRunItemComponentDto[];
};

export type PayrollRunDetailDto = PayrollRunListItemDto & {
  items: PayrollRunItemDto[];
  staffWithoutAssignment: { staffId: string; employeeCode: string; staffName: string }[];
};

export type CreatePayrollRunRequest = { year: number; month: number };
export type AddManualPayrollAdjustmentRequest = { componentId: string; amount: number; reason: string };

export type PayrollPaymentMethodDto = "cash" | "upi" | "card" | "bank_transfer" | "cheque" | "other";
export type PayrollPaymentDto = {
  id: string;
  payrollRunId: string;
  amount: number;
  paymentDate: string;
  method: PayrollPaymentMethodDto;
  reference: string | null;
  createdByName: string | null;
  createdAt: string;
};
export type RecordPayrollPaymentRequest = { paymentDate: string; method: PayrollPaymentMethodDto; reference?: string };

export type PayslipDto = {
  id: string; // PayrollRunItem id
  payrollRunId: string;
  period: string; // "YYYY-MM"
  runStatus: PayrollRunStatusDto;
  school: string;
  employeeCode: string;
  staffName: string;
  earnings: { label: string; amount: number }[];
  deductions: { label: string; amount: number }[];
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
  attendance: PayrollRunItemDto["attendance"];
  paymentStatus: "unpaid" | "paid";
  paidOn: string | null;
  generatedAt: string;
};

export type PayrollComponentBreakdownDto = { componentId: string | null; name: string; type: SalaryComponentTypeDto; amount: number };
export type PayrollEarningsDeductionsReportDto = {
  totalGross: number;
  totalDeductions: number;
  totalNet: number;
  runCount: number;
  byComponent: PayrollComponentBreakdownDto[];
};

export type PayrollDashboardDto = {
  currentPeriod: { year: number; month: number; period: string } | null;
  currentRunStatus: PayrollRunStatusDto | null;
  currentRunGross: number;
  currentRunNet: number;
  currentRunStaffCount: number;
  yearToDateGross: number;
  yearToDateNet: number;
  activeStructures: number;
  staffWithoutAssignment: number;
  recentRuns: PayrollRunListItemDto[];
};

// --- Production Payroll checkpoint: Loans / Advances. One shared domain with
// a `type` discriminator — see the schema doc comment on
// StaffFinancialAdvance for the full policy. `outstanding` is always
// server-derived (approvedAmount - SUM(repayments)), never persisted. No
// interest/EMI, no automatic payroll deduction. ---

export type StaffFinancialAdvanceTypeDto = "loan" | "advance";
export type StaffFinancialAdvanceStatusDto = "pending" | "approved" | "rejected" | "disbursed" | "partially_repaid" | "repaid" | "cancelled";

export type StaffFinancialAdvanceRepaymentDto = {
  id: string;
  amount: number;
  paymentDate: string;
  method: PayrollPaymentMethodDto;
  reference: string | null;
  recordedByName: string | null;
  createdAt: string;
};

export type StaffFinancialAdvanceListItemDto = {
  id: string;
  type: StaffFinancialAdvanceTypeDto;
  number: string;
  staffId: string;
  staffName: string;
  employeeCode: string;
  principalAmount: number;
  approvedAmount: number | null;
  status: StaffFinancialAdvanceStatusDto;
  outstanding: number;
  requestedAt: string;
  createdAt: string;
};

export type StaffFinancialAdvanceDetailDto = StaffFinancialAdvanceListItemDto & {
  purpose: string | null;
  notes: string | null;
  approvedAt: string | null;
  approvedByName: string | null;
  rejectedAt: string | null;
  rejectedByName: string | null;
  rejectionReason: string | null;
  cancelledAt: string | null;
  cancelledByName: string | null;
  disbursedAt: string | null;
  disbursedByName: string | null;
  disbursementMethod: PayrollPaymentMethodDto | null;
  disbursementReference: string | null;
  closedAt: string | null;
  createdByName: string | null;
  repayments: StaffFinancialAdvanceRepaymentDto[];
};

export type CreateStaffFinancialAdvanceRequest = { staffId: string; principalAmount: number; purpose?: string; notes?: string };
export type UpdateStaffFinancialAdvanceRequest = { principalAmount?: number; purpose?: string | null; notes?: string | null };
export type ApproveStaffFinancialAdvanceRequest = { approvedAmount?: number };
export type RejectStaffFinancialAdvanceRequest = { reason: string };
export type DisburseStaffFinancialAdvanceRequest = { disbursementDate: string; method: PayrollPaymentMethodDto; reference?: string };
export type RecordStaffFinancialAdvanceRepaymentRequest = { amount: number; paymentDate: string; method: PayrollPaymentMethodDto; reference?: string };

// --- Phase 9I: Visitor Management ---

export type VisitorCategoryDto = "parent" | "vendor" | "guest" | "contractor" | "interview_candidate" | "alumni" | "official" | "other";
export type VisitorVisitStatusDto = "expected" | "checked_in" | "checked_out" | "cancelled";

export type VisitorVisitListItemDto = {
  id: string;
  visitorId: string;
  visitorName: string;
  visitorPhone: string;
  organization: string | null;
  hostStaffId: string;
  hostName: string;
  category: VisitorCategoryDto;
  purpose: string;
  department: string | null;
  vehicleNumber: string | null;
  status: VisitorVisitStatusDto;
  expectedAt: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  passNumber: string | null;
};

export type VisitorVisitDetailDto = VisitorVisitListItemDto & {
  visitorPastVisitCount: number;
};

export type CreateWalkInVisitRequest = {
  fullName: string;
  phone: string;
  organization?: string;
  category: VisitorCategoryDto;
  purpose: string;
  department?: string;
  vehicleNumber?: string;
  hostStaffId: string;
};

export type CreateExpectedVisitRequest = {
  fullName: string;
  phone: string;
  organization?: string;
  category: VisitorCategoryDto;
  purpose: string;
  department?: string;
  hostStaffId: string;
  expectedAt: string; // ISO datetime
};

export type VisitorDashboardDto = {
  today: number;
  currentlyInside: number;
  expectedToday: number;
  checkedOutToday: number;
  currentlyInsideList: VisitorVisitListItemDto[];
};

export type MyDayDto = {
  date: string; // YYYY-MM-DD, server-derived
  weekday: Weekday;
  staff: CurrentStaffDto | null; // null when the actor has no real teaching Staff profile
  timetable: MyDayTimetableEntryDto[];
  attendance: {
    pendingCount: number; // today's lessons with attendance not yet submitted/locked
    completedCount: number;
  };
  marks: {
    pendingCount: number;
    actions: MyDayMarksActionDto[];
  };
  upcomingExams: UpcomingExamDto[];
  homework: {
    draftCount: number; // this teacher's own DRAFT homework
    dueTodayOrOverdueCount: number; // this teacher's own PUBLISHED homework due today or earlier
    items: HomeworkListItemDto[]; // up to 5, this teacher's own PUBLISHED homework, soonest due first
  };
  lessonPlans: {
    draftCount: number; // this teacher's own DRAFT lesson plans
    items: { id: string; status: LessonPlanStatusDto; section: { id: string; name: string; className: string }; subject: { id: string; name: string; color: string } }[]; // this teacher's plans for TODAY
  };
};

// Named distinctly from the Super Admin platform's DashboardSummaryDto (SA-4J,
// above) — this is the school-side Main Dashboard.
export type SchoolDashboardSummaryDto = {
  date: string;
  weekday: Weekday;
  attendance: AttendanceDashboardDto; // the exact canonical Phase 5B DTO, reused verbatim
  todaysTimetable: {
    available: boolean; // false when the actor has no real teaching Staff profile
    entries: MyDayTimetableEntryDto[];
  };
  upcomingExams: UpcomingExamDto[];
};

// --- Phase 9M: Transport Management. Drivers/attendants are real Staff
// (Staff.id, surfaced as { id, name } snapshots for display — never a
// parallel identity). Students resolve through real Student.id. No GPS/
// telemetry fields anywhere in these DTOs — deliberately deferred. ---

export type TransportVehicleTypeDto = "bus" | "mini-bus" | "van" | "car" | "electric-vehicle" | "contract-vehicle" | "custom";
export type TransportVehicleStatusDto = "active" | "inactive" | "maintenance" | "archived";

export type TransportVehicleDto = {
  id: string;
  registrationNumber: string;
  displayName: string | null;
  type: TransportVehicleTypeDto;
  make: string | null;
  model: string | null;
  capacity: number;
  status: TransportVehicleStatusDto;
  createdAt: string;
  updatedAt: string;
};
export type CreateTransportVehicleRequest = { registrationNumber: string; displayName?: string; type?: TransportVehicleTypeDto; make?: string; model?: string; capacity: number };
export type UpdateTransportVehicleRequest = Partial<CreateTransportVehicleRequest>;
export type SetTransportVehicleStatusRequest = { status: TransportVehicleStatusDto };

export type TransportShiftDto = "morning" | "afternoon" | "evening" | "both";
export type TransportRouteDirectionDto = "pickup" | "drop" | "both";
export type TransportRouteStatusDto = "draft" | "active" | "paused" | "archived";

export type TransportRouteListItemDto = {
  id: string;
  name: string;
  code: string;
  shift: TransportShiftDto;
  direction: TransportRouteDirectionDto;
  capacity: number | null;
  status: TransportRouteStatusDto;
  notes: string | null;
  vehicle: { id: string; registrationNumber: string } | null;
  driver: { id: string; name: string } | null;
  attendant: { id: string; name: string } | null;
  studentCount: number;
  createdAt: string;
  updatedAt: string;
};
export type CreateTransportRouteRequest = { name: string; code: string; shift?: TransportShiftDto; direction?: TransportRouteDirectionDto; capacity?: number; notes?: string };
export type UpdateTransportRouteRequest = Partial<CreateTransportRouteRequest> & { status?: TransportRouteStatusDto };

export type TransportRouteStopDto = { id: string; stopId: string; stopName: string; stopCode: string; sequence: number; pickupTime: string | null; dropTime: string | null };
export type SetRouteStopsRequest = { stops: { stopId: string; sequence: number; pickupTime?: string; dropTime?: string }[] };

export type TransportRouteAssignmentDto = {
  id: string;
  routeId: string;
  vehicleId: string;
  vehicleRegistration: string;
  driverStaffId: string | null;
  driverName: string | null;
  attendantStaffId: string | null;
  attendantName: string | null;
  status: "active" | "ended";
  effectiveFrom: string;
  effectiveTo: string | null;
};
export type SetRouteAssignmentRequest = { vehicleId: string; driverStaffId?: string; attendantStaffId?: string };

export type TransportStopStatusDto = "active" | "temporary" | "unsafe" | "inactive";
export type TransportStopDto = {
  id: string;
  name: string;
  code: string;
  address: string;
  landmark: string | null;
  status: TransportStopStatusDto;
  safetyNotes: string | null;
  routeCount: number;
  studentCount: number;
  createdAt: string;
  updatedAt: string;
};
export type CreateTransportStopRequest = { name: string; code: string; address: string; landmark?: string };
export type FlagStopUnsafeRequest = { safetyNotes: string };
export type SetStopStatusRequest = { status: TransportStopStatusDto };

export type StudentTransportStatusDto = "active" | "suspended" | "withdrawn";
export type StudentTransportAssignmentDto = {
  id: string;
  studentId: string;
  studentName: string;
  routeId: string;
  routeName: string;
  pickupStopId: string;
  pickupStopName: string;
  dropStopId: string;
  dropStopName: string;
  status: StudentTransportStatusDto;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
};
export type AssignStudentTransportRequest = { studentId: string; routeId: string; pickupStopId: string; dropStopId?: string };
export type BulkAssignStudentTransportRequest = { classId: string; routeId: string; pickupStopId: string; dropStopId?: string };
export type BulkAssignResultDto = { assignedCount: number; skippedCount: number };
export type WithdrawStudentTransportRequest = { reason?: string };

export type StaffTransportAssignmentDto = {
  id: string;
  staffId: string;
  staffName: string;
  routeId: string;
  routeName: string;
  pickupStopId: string;
  pickupStopName: string;
  status: StudentTransportStatusDto;
  effectiveFrom: string;
  createdAt: string;
};
export type AssignStaffTransportRequest = { staffId: string; routeId: string; pickupStopId: string };

export type TransportTripTypeDto = "pickup" | "drop";
export type TransportTripStatusDto = "scheduled" | "in-progress" | "completed" | "cancelled";

export type TransportTripListItemDto = {
  id: string;
  routeId: string;
  routeName: string;
  date: string;
  type: TransportTripTypeDto;
  status: TransportTripStatusDto;
  vehicleRegistration: string | null;
  driverName: string | null;
  studentsBoarded: number;
  studentsExpected: number;
  createdAt: string;
};
export type CreateTransportTripRequest = { routeId: string; date: string; type?: TransportTripTypeDto };

export type TransportTripStopStatusDto = "pending" | "arrived" | "departed";
export type TransportTripStopDto = { id: string; stopId: string; stopName: string; sequence: number; status: TransportTripStopStatusDto; arrivedAt: string | null; departedAt: string | null };

export type TransportBoardingStatusDto = "expected" | "boarded" | "absent";
export type TransportDropStatusDto = "onboard" | "dropped";
export type TransportTripStudentDto = {
  id: string;
  studentId: string;
  studentName: string;
  stopId: string;
  stopName: string;
  boardingStatus: TransportBoardingStatusDto;
  dropStatus: TransportDropStatusDto;
  boardedAt: string | null;
  droppedAt: string | null;
};

export type TransportTripDetailDto = TransportTripListItemDto & {
  vehicleId: string | null;
  driverStaffId: string | null;
  attendantStaffId: string | null;
  attendantName: string | null;
  startedAt: string | null;
  completedAt: string | null;
  stops: TransportTripStopDto[];
  students: TransportTripStudentDto[];
};

export type MarkBoardingRequest = { status: TransportBoardingStatusDto };
export type MarkDropRequest = { status: TransportDropStatusDto };

export type TransportDashboardDto = {
  activeVehicles: number;
  activeRoutes: number;
  studentsAssigned: number;
  tripsToday: number;
  tripsInProgress: number;
  tripsCompletedToday: number;
};

/** Real Staff currently on active driver/attendant duty somewhere — derived
 *  from ACTIVE TransportRouteAssignment rows, never a parallel identity. */
export type CurrentTransportStaffDto = { staffId: string; staffName: string; routeId: string; routeName: string };

/** Student 360 Transport tab — the current active assignment (if any), never
 *  live location. */
export type StudentTransportProfileDto = {
  assignment: StudentTransportAssignmentDto | null;
  vehicle: { id: string; registrationNumber: string } | null;
  driverName: string | null;
  attendantName: string | null;
};

// ── Transport checkpoint — Incidents, Maintenance, Fuel, Documents, real-
// data Attendance/Fees/Notifications/Reports/Settings surfaces. No fabricated
// efficiency/utilization/punctuality scores anywhere below; every percentage
// is a plain ratio of two real counts, computed at read time.

export type TransportIncidentTypeDto = "breakdown" | "accident" | "delay" | "safety-concern" | "behaviour" | "other";
export type TransportIncidentSeverityDto = "low" | "medium" | "high" | "critical";
export type TransportIncidentStatusDto = "open" | "investigating" | "resolved" | "closed";

export type TransportIncidentDto = {
  id: string;
  vehicleId: string | null;
  vehicleRegistration: string | null;
  routeId: string | null;
  routeName: string | null;
  tripId: string | null;
  type: TransportIncidentTypeDto;
  severity: TransportIncidentSeverityDto;
  status: TransportIncidentStatusDto;
  occurredAt: string;
  location: string | null;
  description: string;
  immediateAction: string | null;
  resolution: string | null;
  parentNotified: boolean;
  authorityNotified: boolean;
  reportedByName: string;
  resolvedAt: string | null;
  createdAt: string;
};

export type ReportIncidentRequest = {
  type: TransportIncidentTypeDto;
  severity: TransportIncidentSeverityDto;
  occurredAt?: string;
  vehicleId?: string;
  routeId?: string;
  tripId?: string;
  location?: string;
  description: string;
  immediateAction?: string;
  parentNotified?: boolean;
  authorityNotified?: boolean;
};

export type UpdateIncidentStatusRequest = { status: "investigating" | "resolved" | "closed"; resolution?: string };

export type TransportMaintenanceTypeDto = "routine-service" | "repair" | "inspection" | "tyre" | "battery" | "other";
export type TransportMaintenanceStatusDto = "scheduled" | "in-progress" | "completed" | "cancelled";

export type TransportMaintenanceRecordDto = {
  id: string;
  vehicleId: string;
  vehicleRegistration: string;
  type: TransportMaintenanceTypeDto;
  status: TransportMaintenanceStatusDto;
  scheduledDate: string;
  completedDate: string | null;
  /** Derived at read time (scheduledDate < today, not yet completed/cancelled) — never stored. */
  overdue: boolean;
  vendor: string | null;
  odometerKm: number | null;
  partsCost: number;
  labourCost: number;
  totalCost: number;
  notes: string | null;
  createdAt: string;
};

export type ScheduleMaintenanceRequest = { vehicleId: string; type: TransportMaintenanceTypeDto; scheduledDate: string; vendor?: string; notes?: string };
export type CompleteTransportMaintenanceRequest = { completedDate?: string; odometerKm?: number; partsCost: number; labourCost: number };

export type TransportMaintenanceInsightsDto = {
  scheduledOrInProgressCount: number;
  overdueCount: number;
  completedThisMonthCount: number;
  completedCostThisMonth: number;
};

export type TransportFuelLogDto = {
  id: string;
  vehicleId: string;
  vehicleRegistration: string;
  date: string;
  odometerKm: number;
  quantityLitres: number;
  ratePerLitre: number;
  totalCost: number;
  vendor: string | null;
  filledByName: string | null;
  fullTank: boolean;
  createdAt: string;
};

export type LogFuelEntryRequest = { vehicleId: string; date: string; odometerKm: number; quantityLitres: number; ratePerLitre: number; vendor?: string; filledByName?: string; fullTank?: boolean };

export type TransportFuelInsightsDto = { costThisMonth: number; litresThisMonth: number; fuelVehicleCount: number };

export type TransportDocumentSubjectTypeDto = "vehicle" | "staff";
export type TransportDocumentTypeDto = "insurance" | "registration" | "fitness-certificate" | "permit" | "pollution-certificate" | "driving-license" | "police-verification" | "medical-certificate";
/** Derived at read time from expiryDate vs today — never stored. */
export type TransportDocumentEffectiveStatusDto = "valid" | "expiring-soon" | "expired" | "no-expiry";

export type TransportDocumentDto = {
  id: string;
  subjectType: TransportDocumentSubjectTypeDto;
  vehicleId: string | null;
  vehicleRegistration: string | null;
  staffId: string | null;
  staffName: string | null;
  type: TransportDocumentTypeDto;
  documentNumber: string | null;
  expiryDate: string | null;
  effectiveStatus: TransportDocumentEffectiveStatusDto;
  notes: string | null;
  createdAt: string;
};

export type AddTransportDocumentRequest = { subjectType: TransportDocumentSubjectTypeDto; vehicleId?: string; staffId?: string; type: TransportDocumentTypeDto; documentNumber?: string; expiryDate?: string; notes?: string };

export type TransportComplianceSummaryDto = {
  expiredCount: number;
  expiringSoonCount: number;
  blockedVehicleCount: number;
  blockedDriverCount: number;
};

/** Real per-trip TransportTripStudent rows for one date, grouped three ways —
 *  never academic Attendance, never the richer mock status set (only the
 *  real EXPECTED/BOARDED/ABSENT + ONBOARD/DROPPED enums exist). Read-only:
 *  marking happens on the trip detail page (markStudentBoarding/Drop). */
export type TransportAttendanceRouteRowDto = { routeId: string; routeName: string; expected: number; boarded: number; dropped: number; absent: number };
export type TransportAttendanceStopRowDto = { stopId: string; stopName: string; expected: number; boarded: number; absent: number };
export type TransportAttendanceStudentRowDto = {
  tripStudentId: string; studentId: string; studentName: string; routeName: string;
  boardingStatus: TransportBoardingStatusDto; dropStatus: TransportDropStatusDto;
};
export type TransportAttendanceDto = {
  date: string;
  expected: number;
  boarded: number;
  missed: number;
  byRoute: TransportAttendanceRouteRowDto[];
  byStop: TransportAttendanceStopRowDto[];
  students: TransportAttendanceStudentRowDto[];
};

/** Thin view over the real Phase 9F Fees engine, scoped to the "Transport"
 *  FeeCategory — never a parallel collection engine. Actions (assign a
 *  structure, collect a payment) happen on the real Fees pages this links to. */
export type TransportFeesSummaryDto = {
  categoryExists: boolean;
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
  overdueChargeCount: number;
  rows: { studentId: string; studentName: string; admissionNumber: string; itemName: string | null; dueDate: string; billedAmount: number; paidAmount: number; balance: number; status: string }[];
};

/** Thin view over the real Phase 9D Notification engine (type=TRANSPORT_ALERT,
 *  sourceType="transport") — staff-linked User recipients only. No SMS/
 *  WhatsApp/push simulation, no parent audience (no Guardian User account
 *  exists), no rule/trigger automation engine. */
export type TransportNotificationDto = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  recipientCount: number;
  readCount: number;
};

export type SendTransportNotificationRequest = { title: string; body: string; recipientStaffIds: string[] };

// Combined list+insights responses — one GET per page instead of two, so the
// client never has to fire a second request just to render a page's stat tiles.
export type TransportIncidentsListDto = { incidents: TransportIncidentDto[] };
export type TransportMaintenanceListDto = { records: TransportMaintenanceRecordDto[]; insights: TransportMaintenanceInsightsDto };
export type TransportFuelListDto = { records: TransportFuelLogDto[]; insights: TransportFuelInsightsDto };
export type TransportDocumentsListDto = { documents: TransportDocumentDto[]; compliance: TransportComplianceSummaryDto };
export type TransportNotificationsListDto = { notifications: TransportNotificationDto[] };

export type TransportReportsDto = {
  routeUtilization: { routeId: string; routeName: string; assignedCount: number; capacity: number | null; occupancyPercent: number | null }[];
  maintenanceCostCompleted: number;
  fuelCostThisMonth: number;
  compliance: TransportComplianceSummaryDto;
};

// ── Library (Phase 9N) ──────────────────────────────────────────────────────
// A borrower is always a real Student.id or Staff.id — no separate
// LibraryMember identity. Availability is always derived from copy status,
// never a stored aggregate. Fines are computed from the real LibraryPolicy,
// never invented; fine payment/collection is deliberately deferred.

export type LibraryBookStatusDto = "active" | "archived";

export type LibraryBookDto = {
  id: string;
  title: string;
  subtitle: string | null;
  isbn: string | null;
  author: string;
  publisher: string | null;
  publicationYear: number | null;
  category: string | null;
  language: string | null;
  description: string | null;
  status: LibraryBookStatusDto;
  copyCount: number;
  availableCount: number;
  createdAt: string;
  updatedAt: string;
};
export type CreateLibraryBookRequest = {
  title: string;
  subtitle?: string;
  isbn?: string;
  author: string;
  publisher?: string;
  publicationYear?: number;
  category?: string;
  language?: string;
  description?: string;
};
export type UpdateLibraryBookRequest = Partial<CreateLibraryBookRequest> & { status?: LibraryBookStatusDto };

export type LibraryCopyStatusDto = "available" | "issued" | "lost" | "damaged" | "archived";

export type LibraryBookCopyDto = {
  id: string;
  bookId: string;
  bookTitle: string;
  accessionNumber: string;
  barcode: string | null;
  status: LibraryCopyStatusDto;
  acquiredAt: string | null;
  shelfLocation: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};
export type CreateLibraryCopyRequest = { barcode?: string; shelfLocation?: string; notes?: string; acquiredAt?: string };
export type UpdateLibraryCopyRequest = { barcode?: string; shelfLocation?: string; notes?: string };

// Production migration (Phase A) — Digital Library. `url` is always an
// external link: no file/object storage integration exists in this system.
export type LibraryDigitalResourceTypeDto = "ebook" | "notes" | "question_paper" | "audio" | "video" | "other";
export type LibraryDigitalAccessLevelDto = "all" | "students" | "staff";
export type LibraryDigitalResourceDto = {
  id: string;
  title: string;
  subject: string | null;
  type: LibraryDigitalResourceTypeDto;
  url: string;
  accessLevel: LibraryDigitalAccessLevelDto;
  uploadedByName: string;
  createdAt: string;
};
export type CreateLibraryDigitalResourceRequest = {
  title: string; subject?: string; type: LibraryDigitalResourceTypeDto; url: string; accessLevel?: LibraryDigitalAccessLevelDto;
};

// Production migration (Phase A) — Stocktake. expected/scanned/missing are
// always DERIVED live from real LibraryBookCopy + LibraryStocktakeScan rows
// — never stored counts.
export type LibraryStocktakeScopeDto = "shelf" | "full";
export type LibraryStocktakeStatusDto = "in_progress" | "completed";
export type LibraryStocktakeDto = {
  id: string;
  reference: string;
  scope: LibraryStocktakeScopeDto;
  shelfLocation: string | null;
  status: LibraryStocktakeStatusDto;
  startedByName: string;
  startedAt: string;
  completedAt: string | null;
  expectedCount: number;
  scannedCount: number;
  missingCount: number;
};
export type LibraryStocktakeCopyDto = { id: string; accessionNumber: string; bookTitle: string; scannedAt: string | null };
export type LibraryStocktakeDetailDto = LibraryStocktakeDto & {
  scannedCopies: LibraryStocktakeCopyDto[];
  missingCopies: LibraryStocktakeCopyDto[];
};
export type StartStocktakeRequest = { scope: LibraryStocktakeScopeDto; shelfLocation?: string };
export type ScanStocktakeRequest = { code: string };

export type LibraryLoanStatusDto = "issued" | "returned" | "lost" | "cancelled";
export type LibraryBorrowerTypeDto = "student" | "staff";

export type LibraryLoanDto = {
  id: string;
  copyId: string;
  accessionNumber: string;
  bookId: string;
  bookTitle: string;
  borrowerType: LibraryBorrowerTypeDto;
  borrowerId: string;
  borrowerName: string;
  issuedAt: string;
  dueAt: string;
  returnedAt: string | null;
  status: LibraryLoanStatusDto;
  renewalCount: number;
  isOverdue: boolean;
  daysOverdue: number;
  fineAmount: number; // derived from the real, admin-editable LibraryPolicy (defaults to 0/day until configured — never invented)
  createdAt: string;
};
export type IssueLoanRequest = { copyId: string; studentId?: string; staffId?: string; dueAt?: string };
export type ReturnLoanRequest = { condition?: "damaged" };

export type LibraryPolicyDto = {
  loanDurationDays: number;
  finePerDay: number;
  graceDays: number;
  maxFineAmount: number | null;
  updatedAt: string;
};
export type UpdateLibraryPolicyRequest = { loanDurationDays?: number; finePerDay?: number; graceDays?: number; maxFineAmount?: number | null };

export type LibraryDashboardDto = {
  totalTitles: number;
  totalCopies: number;
  availableCopies: number;
  issuedCopies: number;
  lostDamagedCopies: number;
  overdueLoans: number;
  loansToday: number;
  returnsToday: number;
};

/** Student 360 Library tab — real active loans + recent return history,
 *  never a fake fine total or fabricated engagement metric. */
export type StudentLibraryProfileDto = {
  activeLoans: LibraryLoanDto[];
  recentHistory: LibraryLoanDto[];
};

// ── Phase 9O: Inventory Management — consumable / stock-counted items. The
// movement ledger is the sole stock authority; `quantity`/`status` on
// InventoryItemDto are always server-computed, never client-cached. ────────

export type InventoryLocationDto = { id: string; name: string; status: "active" | "archived"; createdAt: string };
export type CreateInventoryLocationRequest = { name: string };

export type InventoryItemStatusDto = "in-stock" | "low-stock" | "out-of-stock" | "discontinued";

export type InventoryItemDto = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  reorderLevel: number | null;
  quantity: number; // always derived from the ledger/balance cache — never stored
  status: InventoryItemStatusDto;
  createdAt: string;
  updatedAt: string;
};
export type CreateInventoryItemRequest = {
  code: string; name: string; description?: string; category?: string; unit: string;
  reorderLevel?: number; openingQuantity?: number; locationId?: string;
};
export type UpdateInventoryItemRequest = {
  name?: string; description?: string | null; category?: string | null; unit?: string;
  reorderLevel?: number | null; status?: "active" | "archived";
};

export type InventoryMovementTypeDto = "opening" | "receipt" | "issue" | "return" | "transfer-out" | "transfer-in" | "adjustment-in" | "adjustment-out";

export type InventoryMovementDto = {
  id: string;
  itemId: string;
  itemName: string;
  itemCode: string;
  locationId: string;
  locationName: string;
  movementType: InventoryMovementTypeDto;
  quantityDelta: number; // signed — positive for inbound, negative for outbound
  referenceType: string | null;
  referenceId: string | null;
  notes: string | null;
  createdByName: string;
  createdAt: string;
};

export type ReceiveStockRequest = { itemId: string; locationId?: string; quantity: number; reference?: string; notes?: string };
export type AdjustStockRequest = { itemId: string; locationId?: string; quantity: number; reason: string };
export type TransferStockRequest = { itemId: string; fromLocationId: string; toLocationId?: string; toLocationName?: string; quantity: number; notes?: string };

export type InventoryTransferDto = {
  id: string; // the shared movement referenceId (correlation id), not a separate table row
  itemId: string;
  itemName: string;
  quantity: number;
  fromLocationId: string;
  fromLocationName: string;
  toLocationId: string;
  toLocationName: string;
  createdAt: string;
};

export type InventoryRecipientKindDto = "staff" | "student" | "other";
export type InventoryIssueStatusDto = "issued" | "partially-returned" | "returned";

export type InventoryIssueDto = {
  id: string;
  itemId: string;
  itemName: string;
  itemCode: string;
  locationId: string;
  locationName: string;
  quantity: number;
  returnedQuantity: number;
  outstandingQuantity: number;
  recipientKind: InventoryRecipientKindDto;
  recipientName: string; // resolved live from Staff/Student, or the OTHER label — never a stored snapshot
  purpose: string | null;
  returnable: boolean;
  status: InventoryIssueStatusDto;
  createdAt: string;
  updatedAt: string;
};
export type IssueStockRequest = {
  itemId: string; locationId?: string; quantity: number;
  recipientKind: InventoryRecipientKindDto; recipientStaffId?: string; recipientStudentId?: string; recipientLabel?: string;
  purpose?: string; returnable?: boolean;
};
export type ReturnIssueRequest = { quantity: number; condition?: "good" | "damaged" };

export type InventoryDashboardDto = {
  totalItems: number;
  totalLocations: number;
  totalUnitsOnHand: number;
  lowStockCount: number;
  outOfStockCount: number;
  movementsToday: number;
  lowStockItems: { id: string; name: string; quantity: number; reorderLevel: number }[];
};

// ── Phase 9O: Asset Management — individually tracked durable assets. No
// depreciation/procurement/vendor system; `cost` is shown as entered, never
// derived. Assignment is Staff-only — no existing UI ever offered a real
// student picker for asset issue. ───────────────────────────────────────

export type AssetStatusDto = "available" | "assigned" | "maintenance" | "lost" | "damaged" | "retired";
export type AssetConditionDto = "good" | "fair" | "poor" | "damaged";
// Production migration (Phase A) — book value is always DERIVED live from
// these inputs (lib/server/assets/depreciation.ts), never stored/posted.
export type AssetDepreciationMethodDto = "none" | "straight_line" | "declining_balance";
export type AssetDisposalReasonDto = "end_of_life" | "damaged" | "sold" | "donated" | "lost" | "stolen" | "replaced" | "other";

export type AssetDisposalDto = {
  id: string;
  assetId: string;
  assetName: string;
  assetTag: string;
  reason: AssetDisposalReasonDto;
  value: number | null;
  recipient: string | null;
  notes: string | null;
  disposedAt: string;
  approvedByName: string | null;
  createdByName: string;
  createdAt: string;
};

export type AssetDto = {
  id: string;
  assetTag: string; // server-generated, unique per school
  name: string;
  category: string | null;
  serialNumber: string | null;
  manufacturer: string | null;
  model: string | null;
  purchaseDate: string | null;
  cost: number | null; // admin-entered acquisition price, shown as-is
  warrantyUntil: string | null;
  notes: string | null;
  locationId: string | null;
  locationName: string | null;
  status: AssetStatusDto;
  condition: AssetConditionDto;
  assignedToStaffId: string | null;
  assignedToName: string | null;
  depreciationMethod: AssetDepreciationMethodDto;
  depreciationRatePercent: number | null;
  salvageValue: number | null;
  /** Both derived live as-of today — never stored, never posted to Accounting. */
  accumulatedDepreciation: number;
  bookValue: number | null;
  disposal: AssetDisposalDto | null;
  createdAt: string;
  updatedAt: string;
};
export type CreateAssetRequest = {
  name: string; category?: string; serialNumber?: string; manufacturer?: string; model?: string;
  purchaseDate?: string; cost?: number; warrantyUntil?: string; notes?: string; locationId?: string; condition?: AssetConditionDto;
  depreciationMethod?: AssetDepreciationMethodDto; depreciationRatePercent?: number; salvageValue?: number;
};
export type UpdateAssetRequest = Partial<CreateAssetRequest>;
export type SetAssetStatusRequest = { status: "lost" | "damaged" | "retired" | "available" };
export type CreateAssetDisposalRequest = {
  reason: AssetDisposalReasonDto; value?: number; recipient?: string; notes?: string; disposedAt: string; approvedByUserId?: string;
};

export type AssetAssignmentDto = {
  id: string;
  assetId: string;
  assetName: string;
  assetTag: string;
  staffId: string;
  staffName: string;
  assignedAt: string;
  returnedAt: string | null;
  status: "active" | "returned";
  notes: string | null;
  createdAt: string;
};
export type AssignAssetRequest = { assetId: string; staffId: string; notes?: string };

export type AssetMaintenanceTypeDto = "preventive" | "repair" | "inspection" | "other";
export type AssetMaintenanceStatusDto = "open" | "in-progress" | "completed" | "cancelled";

export type AssetMaintenanceDto = {
  id: string;
  assetId: string;
  assetName: string;
  assetTag: string;
  type: AssetMaintenanceTypeDto;
  status: AssetMaintenanceStatusDto;
  description: string;
  vendorName: string | null;
  cost: number | null; // display only — no accounting posting
  openedAt: string;
  completedAt: string | null;
  createdAt: string;
};
export type OpenMaintenanceRequest = { assetId: string; type?: AssetMaintenanceTypeDto; description: string; vendorName?: string; cost?: number };
export type CompleteMaintenanceRequest = { status?: "completed" | "cancelled"; cost?: number };

export type AssetDashboardDto = {
  total: number;
  available: number;
  assigned: number;
  maintenance: number;
  lost: number;
  damaged: number;
  retired: number;
  totalCost: number; // sum of admin-entered acquisition prices — not a depreciated book value
  maintenanceOpen: { id: string; assetId: string; assetName: string; type: string }[];
  warrantyExpiringSoon: { id: string; name: string; warrantyUntil: string; status: string }[];
};

export type AssetHistoryEventDto = { id: string; action: string; actorName: string | null; meta: Record<string, unknown> | null; createdAt: string };

// ── Phase 9P: HR Core — Department/Designation master data. Staff.id remains
// the sole canonical employee identity; these are attribute lookups extending
// the real Phase 6A Staff model, never a parallel employee model. ─────────

export type HrMasterStatusDto = "active" | "archived";

export type DepartmentDto = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  headStaffId: string | null;
  headStaffName: string | null; // resolved live from Staff — never a stored name
  status: HrMasterStatusDto;
  staffCount: number; // real count of Staff currently assigned (any status)
  createdAt: string;
  updatedAt: string;
};
export type CreateDepartmentRequest = { code: string; name: string; description?: string; headStaffId?: string };
export type UpdateDepartmentRequest = { name?: string; description?: string | null; headStaffId?: string | null };

export type DesignationDto = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  departmentId: string | null; // optional — a designation need not be department-scoped
  departmentName: string | null;
  level: number | null; // display/sort order only — not a hierarchy or promotion policy
  status: HrMasterStatusDto;
  staffCount: number;
  createdAt: string;
  updatedAt: string;
};
export type CreateDesignationRequest = { code: string; name: string; description?: string; departmentId?: string; level?: number };
export type UpdateDesignationRequest = { name?: string; description?: string | null; departmentId?: string | null; level?: number | null };

// ── Production migration (Phase B, HR Sub-batch 2) — Contracts. Real Staff
// relationship, no parallel employee model. compensationNote is confidential:
// lib/server/hr/contracts.ts redacts it to null for a caller who holds only
// hr.viewOwn (real compensation of record lives in Payroll's
// SalaryStructure/StaffSalaryAssignment — this is a negotiated-terms note,
// never a second source of truth for pay). ─────────────────────────────────

export type ContractTypeDto = "permanent" | "fixed-term" | "probation" | "temporary" | "part-time" | "consultant" | "visiting-faculty";
export type ContractStatusDto = "draft" | "active" | "renewal-pending" | "expired" | "terminated" | "archived";

export type ContractDto = {
  id: string;
  staffId: string;
  staffName: string;
  employeeCode: string;
  type: ContractTypeDto;
  startDate: string; // YYYY-MM-DD
  endDate: string | null;
  probationMonths: number | null;
  noticePeriodDays: number | null;
  workHoursPerWeek: number | null;
  /** null when redacted for the caller (hr.viewOwn without hr.view/hr.manage), or genuinely unset. */
  compensationNote: string | null;
  terms: string | null;
  status: ContractStatusDto;
  /** Derived, never stored: status is active/renewal-pending AND endDate is within 30 days. */
  isExpiringSoon: boolean;
  createdByName: string | null;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateContractRequest = {
  staffId: string;
  type: ContractTypeDto;
  startDate: string;
  endDate?: string;
  probationMonths?: number;
  noticePeriodDays?: number;
  workHoursPerWeek?: number;
  compensationNote?: string;
  terms?: string;
};
export type UpdateContractRequest = Partial<Omit<CreateContractRequest, "staffId">>;

// ── Production migration (Phase B, HR Sub-batch 2) — Staff Documents. No
// binary/object storage exists in this codebase (same precedent as Phase 9M's
// TransportDocument) — metadata only. `visibility` gates whether a document
// ever appears in the owning employee's self-service view; HR_ONLY is the
// default (explicit opt-in required for an employee to see it). ────────────

export type StaffDocumentTypeDto =
  | "id-proof"
  | "tax-id"
  | "qualification"
  | "experience-certificate"
  | "appointment-letter"
  | "contract"
  | "license"
  | "background-check"
  | "medical-fitness"
  | "training-certificate"
  | "custom";
export type StaffDocumentStatusDto = "uploaded" | "verified" | "rejected" | "archived";
export type StaffDocumentVisibilityDto = "hr-only" | "staff-visible";

export type StaffDocumentDto = {
  id: string;
  staffId: string;
  staffName: string;
  employeeCode: string;
  type: StaffDocumentTypeDto;
  title: string;
  status: StaffDocumentStatusDto;
  visibility: StaffDocumentVisibilityDto;
  /** Manual free-text pointer only (e.g. a filing location or external link) — never a real file. No object storage is integrated. */
  externalReference: string | null;
  expiryDate: string | null;
  /** Derived, never stored: expiryDate is in the past. */
  isExpired: boolean;
  notes: string | null;
  uploadedByName: string | null;
  uploadedAt: string;
  verifiedByName: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UploadStaffDocumentRequest = {
  staffId: string;
  type: StaffDocumentTypeDto;
  title: string;
  visibility?: StaffDocumentVisibilityDto;
  externalReference?: string;
  expiryDate?: string;
  notes?: string;
};

// ── Production migration (Phase B, HR Sub-batch 3) — Performance Reviews.
// Deliberately simple: one review record per (staff, period), no
// PerformanceCycle/PerformanceGoal/Feedback multi-stage workflow (those stay
// mock — app/hr/appraisals /goals /feedback). visibleToEmployee is an
// explicit opt-in HR sets — self-service only ever returns a review when
// BOTH status is "completed" AND visibleToEmployee is true. ────────────────

export type PerformanceReviewStatusDto = "draft" | "in-review" | "completed" | "archived";

export type PerformanceReviewDto = {
  id: string;
  staffId: string;
  staffName: string;
  employeeCode: string;
  reviewerId: string;
  reviewerName: string;
  reviewPeriodStart: string;
  reviewPeriodEnd: string;
  reviewDate: string | null;
  status: PerformanceReviewStatusDto;
  overallRating: number | null;
  summary: string | null;
  comments: string | null;
  goals: string | null;
  visibleToEmployee: boolean;
  createdByName: string | null;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreatePerformanceReviewRequest = {
  staffId: string;
  reviewerId: string;
  reviewPeriodStart: string;
  reviewPeriodEnd: string;
  reviewDate?: string;
  overallRating?: number;
  summary?: string;
  comments?: string;
  goals?: string;
  visibleToEmployee?: boolean;
};
export type UpdatePerformanceReviewRequest = Partial<Omit<CreatePerformanceReviewRequest, "staffId" | "reviewerId">> & { reviewerId?: string };

/** The employee's own read of a completed, explicitly-visible review — never
 * exposes reviewerId/internal-only fields beyond what self-service needs. */
export type MyPerformanceReviewDto = {
  id: string;
  reviewPeriodStart: string;
  reviewPeriodEnd: string;
  reviewDate: string | null;
  overallRating: number | null;
  summary: string | null;
  goals: string | null;
};

/** Real DB aggregate counts across the caller's full tenant/school/branch
 * scope — never affected by the current list search/status filter/page, so
 * summary tiles stay correct while the list itself is paginated. */
export type PerformanceReviewSummaryDto = {
  total: number;
  draft: number;
  inReview: number;
  completed: number;
  archived: number;
  averageRating: number | null;
};

// ── Production migration (Phase B, HR Sub-batch 3) — Training. Relational
// participant records (never an array of staff ids on the program). ───────

export type TrainingProgramStatusDto = "draft" | "scheduled" | "in-progress" | "completed" | "cancelled" | "archived";

export type TrainingProgramDto = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  trainerName: string | null;
  startDate: string;
  endDate: string | null;
  status: TrainingProgramStatusDto;
  participantCount: number;
  createdByName: string | null;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateTrainingProgramRequest = {
  title: string;
  description?: string;
  category?: string;
  trainerName?: string;
  startDate: string;
  endDate?: string;
};
export type UpdateTrainingProgramRequest = Partial<CreateTrainingProgramRequest>;

export type TrainingParticipantStatusDto = "assigned" | "in-progress" | "completed" | "cancelled";

export type TrainingParticipantDto = {
  id: string;
  trainingProgramId: string;
  staffId: string;
  staffName: string;
  employeeCode: string;
  status: TrainingParticipantStatusDto;
  completedAt: string | null;
  certificateIssued: boolean;
  assignedByName: string | null;
  assignedAt: string;
};

export type AssignTrainingParticipantRequest = { staffId: string };

/** The employee's own assignment view, with enough program context to be
 * useful without a second round trip. */
export type MyTrainingAssignmentDto = {
  id: string;
  trainingProgramId: string;
  title: string;
  category: string | null;
  startDate: string;
  endDate: string | null;
  programStatus: TrainingProgramStatusDto;
  status: TrainingParticipantStatusDto;
  completedAt: string | null;
  certificateIssued: boolean;
};

/** Real DB aggregate counts across the caller's full tenant/school/branch
 * scope — never affected by the current list search/status filter/page. */
export type TrainingProgramSummaryDto = {
  total: number;
  draft: number;
  scheduled: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  archived: number;
};

// ── Production migration (Phase B, HR Sub-batch 4) — Recruitment. Simple:
// Job Opening + Applicant only, no Interview/ATS pipeline (stays mock). A
// SELECTED applicant is never auto-converted — "Start Onboarding" is an
// explicit HR action that reuses the real Staff provisioning service, then
// opens a real EmployeeOnboarding. ──────────────────────────────────────────

export type JobOpeningStatusDto = "draft" | "open" | "closed" | "archived";

export type JobOpeningDto = {
  id: string;
  title: string;
  departmentId: string | null;
  departmentName: string | null;
  designationId: string | null;
  designationName: string | null;
  employmentType: EmploymentType | null;
  openings: number;
  description: string | null;
  requirements: string | null;
  publishDate: string | null;
  closingDate: string | null;
  status: JobOpeningStatusDto;
  applicantCount: number;
  createdByName: string | null;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateJobOpeningRequest = {
  title: string;
  departmentId?: string;
  designationId?: string;
  employmentType?: EmploymentType;
  openings?: number;
  description?: string;
  requirements?: string;
  publishDate?: string;
  closingDate?: string;
};
export type UpdateJobOpeningRequest = Partial<CreateJobOpeningRequest>;

/** Whole-scope aggregates for the stat tiles — never Interviews/Offers,
 * those entities don't exist in this schema. */
export type RecruitmentSummaryDto = {
  totalOpenings: number;
  open: number;
  closed: number;
  draft: number;
  archived: number;
  positionsAvailable: number;
  totalApplicants: number;
  hired: number;
};

export type JobApplicantStageDto = "applied" | "screening" | "interview" | "selected" | "hired" | "rejected" | "withdrawn";

export type JobApplicantDto = {
  id: string;
  jobOpeningId: string;
  jobOpeningTitle: string;
  candidateName: string;
  email: string;
  phone: string | null;
  source: string | null;
  notes: string | null;
  stage: JobApplicantStageDto;
  appliedDate: string;
  hasOnboarding: boolean;
  createdByName: string | null;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateJobApplicantRequest = {
  jobOpeningId: string;
  candidateName: string;
  email: string;
  phone?: string;
  source?: string;
  notes?: string;
  appliedDate?: string;
};
export type UpdateJobApplicantRequest = Partial<Omit<CreateJobApplicantRequest, "jobOpeningId">>;

export type StartOnboardingRequest = {
  employeeCode: string;
  startDate: string;
  expectedCompletionDate?: string;
  hrOwnerStaffId?: string;
};

// ── Production migration (Phase B, HR Sub-batch 4) — Employee Onboarding.
// NOT SchoolOnboarding (platform-side) — a brand-new-employee's own
// checklist, always tied to a real Staff.id. Progress is always derived from
// real task completion, never a stored percentage. ─────────────────────────

export type EmployeeOnboardingStatusDto = "not-started" | "in-progress" | "completed" | "cancelled";
export type OnboardingTaskStatusDto = "pending" | "completed";

export type OnboardingTaskDto = {
  id: string;
  label: string;
  category: string | null;
  status: OnboardingTaskStatusDto;
  completedAt: string | null;
  completedByName: string | null;
};

export type EmployeeOnboardingDto = {
  id: string;
  staffId: string;
  staffName: string;
  employeeCode: string;
  jobApplicantId: string | null;
  hrOwnerStaffId: string | null;
  hrOwnerName: string | null;
  startDate: string;
  expectedCompletionDate: string | null;
  status: EmployeeOnboardingStatusDto;
  /** Derived live from tasks (completed/total) — never stored. */
  progressPercent: number;
  tasks: OnboardingTaskDto[];
  createdByName: string | null;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateEmployeeOnboardingRequest = {
  staffId: string;
  startDate: string;
  expectedCompletionDate?: string;
  hrOwnerStaffId?: string;
};
export type UpdateEmployeeOnboardingRequest = { expectedCompletionDate?: string | null; hrOwnerStaffId?: string | null };

// ── Production migration (Phase B, HR Sub-batch 4) — HR Policies. Only
// PUBLISHED policies ever reach Employee Self Service. Acknowledgement is
// identity-scoped — an employee acknowledges ONLY their own Staff record,
// resolved server-side. ─────────────────────────────────────────────────────

export type HrPolicyStatusDto = "draft" | "published" | "archived";

export type HrPolicyDto = {
  id: string;
  title: string;
  category: string | null;
  content: string;
  version: string;
  effectiveDate: string | null;
  status: HrPolicyStatusDto;
  acknowledgedCount: number;
  createdByName: string | null;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateHrPolicyRequest = { title: string; category?: string; content: string; version: string; effectiveDate?: string };
export type UpdateHrPolicyRequest = Partial<CreateHrPolicyRequest>;

/** Self-service — only ever a PUBLISHED policy, with the caller's own acknowledgement state. */
export type MyHrPolicyDto = {
  id: string;
  title: string;
  category: string | null;
  content: string;
  version: string;
  effectiveDate: string | null;
  acknowledged: boolean;
  acknowledgedAt: string | null;
};

// ── Production migration (Phase B, HR Sub-batch 4) — Shifts. Relational
// ShiftAssignment (never an array of staff ids). Overlap prevention mirrors
// StaffSalaryAssignment's row-locked check exactly. ─────────────────────────

export type ShiftStatusDto = "active" | "inactive";

export type ShiftDto = {
  id: string;
  name: string;
  startTime: string; // HH:mm, derived from startMinutes
  endTime: string; // HH:mm, derived from endMinutes
  startMinutes: number;
  endMinutes: number;
  breakMinutes: number | null;
  workingDays: string[];
  status: ShiftStatusDto;
  assignedCount: number;
  createdByName: string | null;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateShiftRequest = { name: string; startMinutes: number; endMinutes: number; breakMinutes?: number; workingDays?: string[] };
export type UpdateShiftRequest = Partial<CreateShiftRequest>;

export type ShiftAssignmentDto = {
  id: string;
  shiftId: string;
  staffId: string;
  staffName: string;
  employeeCode: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  assignedByName: string | null;
  createdAt: string;
};

export type AssignShiftRequest = { staffId: string; effectiveFrom: string; effectiveUntil?: string };

/** Self-service — the caller's own currently-effective shift, if any. */
export type MyShiftDto = {
  shiftId: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number | null;
  workingDays: string[];
  effectiveFrom: string;
  effectiveUntil: string | null;
} | null;

/** HR Core dashboard — DB-derived only. Present/absent/late/on-leave/
 * not-marked reuse the canonical Phase 9E Staff Attendance summary verbatim.
 * No fabricated attrition/retention/engagement/performance/recruitment-
 * pipeline metrics. */
export type HrDashboardDto = {
  activeStaff: number;
  teachingStaff: number;
  nonTeachingStaff: number;
  departments: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
  onLeaveToday: number;
  notMarkedToday: number;
  newHiresThisMonth: number; // real Staff.joiningDate within the current calendar month
  // HR Sub-batch 4 — real, school-wide, never fabricated. Open job openings
  // and applicant-stage counts derive from JobOpening/JobApplicant; active
  // onboardings/avg progress derive from EmployeeOnboarding+OnboardingTask.
  openJobOpenings: number;
  applicantsByStage: Record<JobApplicantStageDto, number>;
  activeOnboardings: number;
  /** null when there are zero onboardings — never a fabricated 0%. */
  avgOnboardingProgress: number | null;
};

// ── Phase 9Q: Hostel Management. Hostel student identity always resolves to
// real Student.id; warden identity always resolves to real Staff.id. Room
// capacity is never a stored field (always `count(beds)`); occupancy is
// always derived from the active-assignment invariant, never a persisted
// counter. No Block/Floor entity — `floorNumber` is a plain field on Room. ─

export type HostelGenderPolicyDto = "boys" | "girls" | "mixed";
export type HostelMasterStatusDto = "active" | "maintenance" | "archived";

export type HostelDto = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  genderPolicy: HostelGenderPolicyDto | null;
  status: HostelMasterStatusDto;
  roomCount: number;
  createdAt: string;
  updatedAt: string;
};
export type CreateHostelRequest = { code: string; name: string; description?: string; genderPolicy?: HostelGenderPolicyDto };
export type UpdateHostelRequest = { name?: string; description?: string | null; genderPolicy?: HostelGenderPolicyDto | null; status?: HostelMasterStatusDto };

export type HostelRoomDto = {
  id: string;
  hostelId: string;
  hostelName: string;
  roomNumber: string;
  floorNumber: number | null;
  roomType: string | null;
  facilities: string[];
  notes: string | null;
  status: HostelMasterStatusDto;
  totalBeds: number; // == capacity — always derived, never a stored field
  activeBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  createdAt: string;
  updatedAt: string;
};
export type CreateHostelRoomRequest = { hostelId: string; roomNumber: string; floorNumber?: number; roomType?: string; facilities?: string[]; notes?: string; capacity: number };
export type UpdateHostelRoomRequest = { floorNumber?: number | null; roomType?: string | null; facilities?: string[]; notes?: string | null; status?: HostelMasterStatusDto };

export type HostelBedDto = {
  id: string;
  roomId: string;
  roomNumber: string;
  hostelId: string;
  hostelName: string;
  bedNumber: string;
  status: HostelMasterStatusDto;
  occupied: boolean; // always derived from an active StudentHostelAssignment
  occupantStudentId: string | null;
  occupantName: string | null; // resolved live from Student — never a stored snapshot
  createdAt: string;
  updatedAt: string;
};
export type SetHostelBedStatusRequest = { status: HostelMasterStatusDto };

export type HostelAssignmentStatusDto = "active" | "vacated" | "transferred";

export type HostelAssignmentDto = {
  id: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  hostelId: string;
  hostelName: string;
  roomId: string;
  roomNumber: string;
  bedId: string;
  bedNumber: string;
  academicSessionId: string;
  assignedAt: string;
  vacatedAt: string | null;
  status: HostelAssignmentStatusDto;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};
export type AssignHostelStudentRequest = { studentId: string; bedId: string; notes?: string };
export type TransferHostelAssignmentRequest = { toBedId: string; notes?: string };

export type HostelStaffRoleDto = "warden" | "assistant_warden";
export type HostelStaffAssignmentStatusDto = "active" | "ended";

export type HostelStaffAssignmentDto = {
  id: string;
  hostelId: string;
  hostelName: string;
  staffId: string;
  staffName: string;
  employeeCode: string;
  role: HostelStaffRoleDto;
  status: HostelStaffAssignmentStatusDto;
  assignedAt: string;
  endedAt: string | null;
  createdAt: string;
};
export type AssignHostelStaffRequest = { hostelId: string; staffId: string; role?: HostelStaffRoleDto };

export type HostelRollCallStatusDto = "present" | "absent" | "on_leave" | "not-marked";

export type HostelRollCallEntryDto = {
  studentId: string;
  studentName: string;
  admissionNumber: string;
  hostelId: string;
  hostelName: string;
  roomNumber: string;
  bedNumber: string;
  status: HostelRollCallStatusDto;
  recordId: string | null;
  notes: string | null;
};
export type MarkHostelRollCallRequest = { studentId: string; date: string; status: "present" | "absent" | "on_leave"; notes?: string };

/** Hostel Dashboard — DB-derived only. No fabricated fee collection/meal
 * satisfaction/parent approval/security score/complaint SLA. */
export type HostelDashboardDto = {
  totalHostels: number;
  totalRooms: number;
  roomsInMaintenance: number;
  totalBeds: number;
  activeBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  occupancyPct: number;
  activeResidents: number;
  presentTonight: number;
  onLeaveTonight: number;
  notMarkedTonight: number;
};

/** Student 360 Hostel tab — real current assignment + history, never a fake
 * fee balance. */
export type StudentHostelProfileDto = {
  current: {
    id: string; hostelName: string; roomNumber: string; bedNumber: string;
    assignedAt: string; vacatedAt: string | null; status: HostelAssignmentStatusDto; wardenName: string | null;
  } | null;
  history: { id: string; hostelName: string; roomNumber: string; bedNumber: string; assignedAt: string; vacatedAt: string | null; status: HostelAssignmentStatusDto }[];
};

// ── Phase 9R: Health / Infirmary Management. A patient is always exactly one
// real Student.id or Staff.id. Administrative record-keeping only — never a
// diagnosis/prescription/triage engine. Sensitive fields (reason, notes,
// vitals, treatment, medication, allergy/condition text) are null unless the
// caller holds health.viewSensitive — a redacted DTO, not a missing one.

export type HealthPatientTypeDto = "student" | "staff";

export type HealthProfileDto = {
  id: string | null; // null when no profile has been created yet
  patientType: HealthPatientTypeDto;
  patientId: string;
  bloodGroup: string | null;
  allergiesText: string | null;
  chronicConditionsText: string | null;
  careInstructions: string | null;
  physicianName: string | null;
  physicianPhone: string | null;
  insuranceProvider: string | null;
  insuranceNumberMasked: string | null;
  updatedAt: string | null;
};

export type UpsertHealthProfileRequest = {
  bloodGroup?: string | null;
  allergiesText?: string | null;
  chronicConditionsText?: string | null;
  careInstructions?: string | null;
  physicianName?: string | null;
  physicianPhone?: string | null;
  insuranceProvider?: string | null;
  insuranceNumberMasked?: string | null;
};

export type HealthVisitStatusDto = "open" | "closed" | "referred";

export type HealthVisitDto = {
  id: string;
  patientType: HealthPatientTypeDto;
  patientId: string;
  patientName: string;
  patientRef: string; // admissionNumber or employeeCode
  status: HealthVisitStatusDto;
  reason: string | null; // null when redacted (no health.viewSensitive)
  symptomsReported: string | null;
  observationNotes: string | null;
  careAction: string | null;
  guardianContacted: boolean;
  referralDestination: string | null;
  referralNotes: string | null;
  followUpAt: string | null;
  attendedByStaffId: string | null;
  attendedByStaffName: string | null;
  checkedInAt: string;
  checkedOutAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type HealthVitalObservationDto = {
  id: string;
  temperatureC: number | null;
  pulseBpm: number | null;
  systolic: number | null;
  diastolic: number | null;
  oxygenSaturationPct: number | null;
  weightKg: number | null;
  heightCm: number | null;
  recordedAt: string;
  recordedByUserId: string;
};

export type RecordHealthVitalsRequest = {
  temperatureC?: number;
  pulseBpm?: number;
  systolic?: number;
  diastolic?: number;
  oxygenSaturationPct?: number;
  weightKg?: number;
  heightCm?: number;
};

export type HealthTreatmentRecordDto = {
  id: string;
  description: string;
  administeredByStaffId: string | null;
  administeredByStaffName: string | null;
  administeredAt: string;
};

export type RecordHealthTreatmentRequest = { description: string };

export type HealthMedicationAdministrationDto = {
  id: string;
  medicationName: string;
  quantity: string | null;
  unit: string | null;
  notes: string | null;
  administeredByStaffId: string | null;
  administeredByStaffName: string | null;
  administeredAt: string;
};

export type RecordHealthMedicationRequest = { medicationName: string; quantity?: string; unit?: string; notes?: string };

export type HealthVisitDetailDto = HealthVisitDto & {
  vitals: HealthVitalObservationDto[];
  treatments: HealthTreatmentRecordDto[];
  medications: HealthMedicationAdministrationDto[];
};

export type CreateHealthVisitRequest = {
  studentId?: string;
  staffId?: string;
  reason: string;
  symptomsReported?: string;
  observationNotes?: string;
  careAction?: string;
  guardianContacted?: boolean;
};

export type UpdateHealthVisitRequest = {
  reason?: string;
  symptomsReported?: string;
  observationNotes?: string;
  careAction?: string;
  guardianContacted?: boolean;
  followUpAt?: string | null;
};

export type ReferHealthVisitRequest = { referralDestination?: string; referralNotes?: string; followUpAt?: string };

/** Health Dashboard — DB-derived only. No fabricated risk score/outbreak
 * alert/vaccination compliance/illness trend conclusions. */
export type HealthDashboardDto = {
  visitsToday: number;
  studentVisitsToday: number;
  staffVisitsToday: number;
  openVisits: number;
  referredToday: number;
  followUpsDue: number;
  medicationsRecordedToday: number;
};

/** Student 360 Health tab — real profile + visit history, redacted per
 * caller's health.viewSensitive. Emergency contacts are derived live from
 * real StudentGuardian.isEmergencyContact + Guardian records, never
 * duplicated into a health-domain field. */
export type StudentHealthProfileDto = {
  profile: HealthProfileDto;
  openVisit: HealthVisitDto | null;
  recentVisits: HealthVisitDto[];
  medicationHistory: HealthMedicationAdministrationDto[];
  emergencyContacts: { name: string; phone: string | null; relation: string }[];
};

// ── Phase 9S: Counseling / Student Wellbeing. A SEPARATE confidential domain
// from Health. A student is always a real Student.id; a counselor is always
// a real, active Staff.id. Case METADATA (this DTO) is deliberately separate
// from CONFIDENTIAL session notes (CounselingSessionNoteDto) — the latter is
// never included here or in any list endpoint.

export type CounselingCaseStatusDto = "open" | "active" | "closed";
export type CounselingReferralSourceDto = "self" | "teacher" | "parent_guardian" | "staff" | "admin" | "other";
export type CounselingConcernCategoryDto = "academic" | "peer_relationships" | "behavioral" | "family" | "emotional_wellbeing" | "other";

export type CounselingCaseDto = {
  id: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  assignedCounselorStaffId: string | null;
  assignedCounselorName: string | null;
  referralSource: CounselingReferralSourceDto | null;
  referralReason: string | null; // factual, manually-recorded text — never a digitally-submitted consent/referral
  referredByUserId: string | null;
  referredAt: string | null;
  concernCategory: CounselingConcernCategoryDto | null; // factual classification, never a diagnosis
  summary: string | null; // non-confidential case-level summary
  status: CounselingCaseStatusDto;
  followUpDate: string | null;
  sessionCount: number;
  openedAt: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateCounselingReferralRequest = {
  studentId: string;
  referralSource?: CounselingReferralSourceDto;
  referralReason?: string;
  concernCategory?: CounselingConcernCategoryDto;
  summary?: string;
};

export type UpdateCounselingCaseRequest = {
  concernCategory?: CounselingConcernCategoryDto | null;
  summary?: string | null;
  followUpDate?: string | null;
};

export type AssignCounselingCaseRequest = { counselorStaffId: string };

export type CounselingSessionDto = {
  id: string;
  caseId: string;
  counselorStaffId: string;
  counselorName: string;
  sessionDate: string;
  endedAt: string | null;
  sessionType: string | null;
  summary: string | null; // non-confidential factual summary — never the confidential note body
  followUpDate: string | null;
  noteCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateCounselingSessionRequest = {
  sessionDate?: string;
  endedAt?: string;
  sessionType?: string;
  summary?: string;
  followUpDate?: string;
};

/** Confidential — only ever returned by a dedicated endpoint gated by
 * counseling.viewConfidential AND counselor ownership. Never in a list DTO. */
export type CounselingSessionNoteDto = {
  id: string;
  sessionId: string;
  body: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateCounselingNoteRequest = { body: string };

/** Counseling Dashboard — DB-derived only. No fabricated risk score/wellbeing
 * score/success rate/severity distribution. "my*" fields are populated only
 * when the caller resolves to a real, active counselor Staff record. */
export type CounselingDashboardDto = {
  totalOpenCases: number;
  totalActiveCases: number;
  unassignedCases: number;
  sessionsToday: number;
  followUpsDue: number;
  myOpenCases: number;
  myActiveCases: number;
  myFollowUpsDue: number;
};

/** Student 360 Counseling tab — safe metadata ONLY (counseling.view). No
 * confidential note content is ever included here. */
export type StudentCounselingProfileDto = {
  hasActiveSupport: boolean;
  currentCase: {
    id: string; status: CounselingCaseStatusDto; assignedCounselorName: string | null;
    concernCategory: CounselingConcernCategoryDto | null; followUpDate: string | null;
  } | null;
  caseCount: number;
};

// ── Phase 9T: Cafeteria / Meal Management. A meal consumer is always exactly
// one real Student.id or Staff.id. No wallet, no online ordering, no
// payment gateway. priceMinorUnits (if set) is informational display text
// only — never a Fees/Accounting receivable.

export type CafeteriaStatusDto = "active" | "inactive" | "archived";

export type CafeteriaLocationDto = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: CafeteriaStatusDto;
  createdAt: string;
  updatedAt: string;
};

export type CreateCafeteriaLocationRequest = { code: string; name: string; description?: string };
export type UpdateCafeteriaLocationRequest = { name?: string; description?: string | null; status?: CafeteriaStatusDto };

export type CafeteriaItemStatusDto = "active" | "archived";

export type CafeteriaItemDto = {
  id: string;
  code: string;
  name: string;
  category: string | null;
  description: string | null;
  dietaryTags: string[]; // informational only — never a medical/allergy authority
  priceMinorUnits: number | null; // informational only — never a Fees/Accounting receivable
  status: CafeteriaItemStatusDto;
  createdAt: string;
  updatedAt: string;
};

export type CreateCafeteriaItemRequest = {
  code: string; name: string; category?: string; description?: string; dietaryTags?: string[]; priceMinorUnits?: number;
};
export type UpdateCafeteriaItemRequest = {
  name?: string; category?: string | null; description?: string | null; dietaryTags?: string[]; priceMinorUnits?: number | null; status?: CafeteriaItemStatusDto;
};

export type CafeteriaMealTypeDto = "breakfast" | "lunch" | "snacks" | "dinner" | "a-la-carte";

export type CafeteriaMenuItemDto = {
  id: string;
  cafeteriaItemId: string;
  name: string;
  category: string | null;
  dietaryTags: string[];
  priceMinorUnits: number | null;
  servingOrder: number | null;
};

export type CafeteriaMenuDto = {
  id: string;
  locationId: string;
  locationName: string;
  date: string; // YYYY-MM-DD
  mealType: CafeteriaMealTypeDto;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CafeteriaMenuDetailDto = CafeteriaMenuDto & { items: CafeteriaMenuItemDto[] };

export type CreateCafeteriaMenuRequest = { locationId?: string; date: string; mealType: CafeteriaMealTypeDto; itemIds?: string[] };
export type SetCafeteriaMenuItemsRequest = { itemIds: string[] };

export type CafeteriaConsumerTypeDto = "student" | "staff";

export type CafeteriaMealRecordDto = {
  id: string;
  menuId: string;
  menuDate: string;
  mealType: CafeteriaMealTypeDto;
  cafeteriaItemId: string | null;
  itemName: string | null;
  consumerType: CafeteriaConsumerTypeDto;
  consumerId: string;
  consumerName: string;
  consumerRef: string; // admissionNumber or employeeCode
  servedAt: string;
  quantity: number;
  servedByUserId: string;
  notes: string | null;
  createdAt: string;
};

export type RecordCafeteriaMealRequest = { menuId: string; studentId?: string; staffId?: string; cafeteriaItemId?: string; quantity?: number; notes?: string };

/** Cafeteria Dashboard — DB-derived only. No fabricated sales/revenue/
 * profit/wastage%/nutrition or satisfaction score. */
export type CafeteriaDashboardDto = {
  mealsServedToday: number;
  studentMealsToday: number;
  staffMealsToday: number;
  activeItems: number;
  menusToday: number;
  locationCount: number;
};

/** Student 360 Cafeteria tab — recent real meal history only. */
export type StudentCafeteriaProfileDto = {
  recentMeals: CafeteriaMealRecordDto[];
};

// ── Phase 9U: Activities / Student Life. A member is always a real Student.id;
// a coordinator/coach/mentor is always a real Staff.id. Event participation is
// deliberately NOT academic Attendance. No score/rank/certificate authority.

export type ActivityTypeDto = "club" | "sport" | "cultural" | "academic" | "service" | "other";
export type ActivityStatusDto = "active" | "inactive" | "archived";

export type ActivityDto = {
  id: string;
  code: string;
  name: string;
  type: ActivityTypeDto;
  description: string | null;
  status: ActivityStatusDto;
  capacity: number | null;
  memberCount: number;
  coordinatorNames: string[];
  createdAt: string;
  updatedAt: string;
};

export type CreateActivityRequest = { code: string; name: string; type: ActivityTypeDto; description?: string; capacity?: number };
export type UpdateActivityRequest = { name?: string; description?: string | null; capacity?: number | null; status?: ActivityStatusDto };

export type ActivityStaffRoleDto = "coordinator" | "coach" | "mentor";
export type ActivityStaffAssignmentDto = {
  id: string;
  activityId: string;
  staffId: string;
  staffName: string;
  role: ActivityStaffRoleDto;
  status: "active" | "ended";
  assignedAt: string;
  endedAt: string | null;
};
export type AssignActivityStaffRequest = { staffId: string; role?: ActivityStaffRoleDto };

export type ActivityMembershipStatusDto = "active" | "ended";
export type ActivityMembershipDto = {
  id: string;
  activityId: string;
  activityName: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  status: ActivityMembershipStatusDto;
  joinedAt: string;
  leftAt: string | null;
};
export type JoinActivityRequest = { studentId: string };

export type ActivityEventStatusDto = "draft" | "published" | "completed" | "cancelled";
export type ActivityEventDto = {
  id: string;
  activityId: string;
  activityName: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string | null;
  location: string | null;
  status: ActivityEventStatusDto;
  participantCount: number;
  createdAt: string;
  updatedAt: string;
};
export type CreateActivityEventRequest = { activityId: string; title: string; description?: string; startAt: string; endAt?: string; location?: string };
export type UpdateActivityEventRequest = { title?: string; description?: string | null; startAt?: string; endAt?: string | null; location?: string | null };

export type ActivityParticipantStatusDto = "registered" | "attended" | "absent" | "cancelled";
export type ActivityEventParticipantDto = {
  id: string;
  eventId: string;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  status: ActivityParticipantStatusDto;
  registeredAt: string;
  attendedAt: string | null;
};
export type RegisterActivityParticipantRequest = { studentId: string };
export type UpdateActivityParticipantRequest = { status: ActivityParticipantStatusDto };

/** Factual, manually-entered record — never a score, rank, or auto-generated award. */
export type StudentAchievementDto = {
  id: string;
  studentId: string;
  activityId: string | null;
  activityName: string | null;
  title: string;
  description: string | null;
  awardedAt: string;
  createdAt: string;
};
export type CreateStudentAchievementRequest = { studentId: string; activityId?: string; title: string; description?: string; awardedAt: string };

/** Activities Dashboard — DB-derived only. No fabricated engagement score,
 * participation quality, performance, or attendance percentage. */
export type ActivityDashboardDto = {
  activeActivities: number;
  activeMemberships: number;
  upcomingEvents: number;
  eventsThisMonth: number;
  coordinatorCount: number;
  participationCount: number;
};

/** Student 360 Activities tab — real memberships/events/participation only. */
export type StudentActivityProfileDto = {
  activeMemberships: ActivityMembershipDto[];
  pastMemberships: ActivityMembershipDto[];
  upcomingEvents: ActivityEventDto[];
  recentParticipation: ActivityEventParticipantDto[];
  achievements: StudentAchievementDto[];
};

// ── Document Studio (Phase 9V) ───────────────────────────────────────────
// A subject is always a real Student.id or Staff.id — never a parallel
// identity. GeneratedDocument.rendered is an immutable historical snapshot:
// later edits to the Student/Staff/School/template never change it. Merge
// fields are server-allowlisted (see lib/server/document-studio/merge-fields
// .ts) — there is no arbitrary property-path lookup. Scope is deliberately
// narrow: only document types with genuine real-data backing.

export type DocumentKindDto = "id-card" | "student-certificate" | "staff-certificate";
export type DocTypeDto = "student-id" | "staff-id" | "bonafide-certificate" | "study-certificate" | "achievement-certificate" | "employment-certificate";
export type DocSubjectTypeDto = "student" | "staff";
export type DocTemplateStatusDto = "draft" | "active" | "archived";
export type DocPaperSizeDto = "cr80" | "a4" | "a5" | "letter" | "legal" | "cert-portrait" | "cert-landscape" | "thermal" | "custom-card";
export type DocOrientationDto = "portrait" | "landscape";
export type DocIdCardStyleDto = "campus-modern" | "classic-school" | "minimal-institutional" | "premium-teal" | "junior-friendly";

export type DocTemplateSectionDto = {
  id: string;
  type: string;
  label: string;
  show: boolean;
  align: "left" | "center" | "right";
  fontSize: "xs" | "sm" | "base" | "lg" | "xl";
  fontWeight: "normal" | "medium" | "semibold" | "bold";
  color?: string;
  order: number;
  customText?: string;
};

export type DocumentTemplateDto = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  kind: DocumentKindDto;
  docType: DocTypeDto;
  subjectType: DocSubjectTypeDto;
  status: DocTemplateStatusDto;
  version: number;
  paperSize: DocPaperSizeDto;
  orientation: DocOrientationDto;
  accent: string;
  style?: DocIdCardStyleDto;
  sections: DocTemplateSectionDto[];
  variables: string[];
  signatoryName?: string;
  usageCount: number;
  isDefault: false;
  thumbnailTone: "info";
  createdAt: string;
  updatedAt: string;
};

export type CreateDocumentTemplateRequest = {
  code: string;
  name: string;
  description?: string;
  docType: DocTypeDto;
  paperSize: DocPaperSizeDto;
  orientation: DocOrientationDto;
  accent: string;
  style?: DocIdCardStyleDto;
  sections: DocTemplateSectionDto[];
  variables: string[];
  signatoryName?: string;
};

export type UpdateDocumentTemplateRequest = {
  name?: string;
  description?: string | null;
  paperSize?: DocPaperSizeDto;
  orientation?: DocOrientationDto;
  accent?: string;
  style?: DocIdCardStyleDto;
  sections?: DocTemplateSectionDto[];
  variables?: string[];
  signatoryName?: string;
};

export type MergeFieldDto = { key: string; label: string };

export type DocumentSheetDataDto = {
  type: DocTypeDto;
  kind: DocumentKindDto;
  paperSize: DocPaperSizeDto;
  number?: string;
  accent: string;
  recipientName: string;
  recipientSubtitle?: string;
  fields: Record<string, string>;
  signatoryName?: string;
  issuedDate?: string;
  token?: string;
  showSeal?: boolean;
  schoolName?: string;
  schoolAddress?: string;
  schoolContact?: string;
};

export type IdCardRecordDto = {
  id: string;
  cardNumber: string;
  kind: "student" | "staff";
  holderName: string;
  subtitle: string;
  photoColor: string;
  style: DocIdCardStyleDto;
  issueDate?: string;
  expiryDate: string;
  status: "issued" | "cancelled";
  verificationToken: string;
  extra: Record<string, string>;
  schoolName?: string;
  schoolAddress?: string;
  schoolContact?: string;
  schoolWebsite?: string;
};

export type GeneratedDocumentStatusDto = "generated" | "void";

export type GeneratedDocumentDto = {
  id: string;
  documentNumber: string;
  docType: DocTypeDto;
  kind: DocumentKindDto;
  subjectType: DocSubjectTypeDto;
  templateId: string;
  templateName: string;
  templateVersion: number;
  studentId: string | null;
  staffId: string | null;
  recipientName: string;
  recipientSubtitle: string | null;
  status: GeneratedDocumentStatusDto;
  generatedByName: string;
  generatedAt: string;
  voidedAt: string | null;
  voidReason: string | null;
  rendered: DocumentSheetDataDto | IdCardRecordDto;
};

export type GenerateDocumentRequest = { templateId: string; studentId?: string; staffId?: string; achievementId?: string; purpose?: string };
export type PreviewDocumentRequest = GenerateDocumentRequest;
export type PreviewDocumentResponse = { rendered: DocumentSheetDataDto | IdCardRecordDto; unresolved: string[] };
export type VoidDocumentRequest = { reason: string };

export type DocumentStudioDashboardDto = {
  activeTemplates: number;
  generatedToday: number;
  generatedThisMonth: number;
  voidedCount: number;
  studentDocuments: number;
  staffDocuments: number;
};

// --- Academics hub aggregation — composes existing canonical domain services
// (Classes, Staff, Attendance, Curriculum, Homework, Lesson Plans, Calendar).
// No new calculations: every figure here is either a real count or a DTO
// reused verbatim from its owning service. There is no "timetable conflicts"
// or "substitute requirement" metric — real timetable conflicts are prevented
// at the database level (structurally always zero) and no Substitute domain
// exists, so both were dropped rather than fabricated. ---

export type AcademicsDashboardDto = {
  activeClasses: number;
  teachingStaffCount: number;
  teachingStaffOnLeaveToday: number;
  attendance: AttendanceDashboardDto;
  curriculum: CurriculumInsightsDto;
  homework: { draftCount: number; publishedCount: number; overdueOpenCount: number };
  lessonPlans: { draftCount: number; pendingApprovalCount: number; approvedCount: number };
  upcomingEvents: CalendarEventDto[];
};

// --- Results hub aggregation — one row per exam that has reached the results
// stage (status scheduled/completed/archived; a "draft" exam with no schedule
// has nothing to show here), composing the real Phase 8B/8C/8D services.
// marksPercent/verificationPercent are aggregated from the real per-paper
// marks summary; "report cards" are not a separate generation step (Phase 8D
// has no ReportCard model) — reportCardCount is just studentCount once
// published. No "inconsistency"/"blocking issue" text is fabricated. ---

export type ResultsPipelineStageKey = "marks" | "verification" | "results" | "publication";
export type ResultsPipelineStageStatus = "complete" | "in-progress" | "not-started";
export type ResultsPipelineStageDto = { key: ResultsPipelineStageKey; label: string; status: ResultsPipelineStageStatus };

export type ResultsPipelineRowDto = {
  examId: string;
  examName: string;
  examCode: string;
  examStatus: ExamStatus;
  startsOn: string;
  endsOn: string;
  className: string; // derived from the real schedule entries' sections
  marksPercent: number;
  verificationPercent: number;
  studentCount: number;
  incompleteCount: number;
  reportCardCount: number;
  published: boolean;
  publishedAt: string | null;
  stages: ResultsPipelineStageDto[];
  primaryAction: { label: string; href: string };
};

// ---------------------------------------------------------------------------
// Account — the logged-in user's own identity/profile and personal account
// settings (avatar dropdown, /profile, /settings). Identity-scoped (this
// user's own row), never permission-scoped — every authenticated user can
// read/manage their own account regardless of role. No school-administration
// config lives here.
// ---------------------------------------------------------------------------

export type MyProfileDto = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  phone: string | null;
  /** e.g. "Employee ID" / "Admission No." — null when nothing applies (e.g. a Guardian or a User with no linked Staff/Student). */
  idLabel: string | null;
  idValue: string | null;
  designation: string | null;
  department: string | null;
  schoolName: string | null;
  branchName: string | null;
  /** School-level locale defaults (read-only here — set by the school, not per-user). */
  schoolTimezone: string | null;
  schoolLocale: string | null;
  schoolCurrency: string | null;
};

export type ChangePasswordRequest = { currentPassword: string; newPassword: string };

export type MySessionDto = {
  id: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
};

export type ResultsDashboardDto = { rows: ResultsPipelineRowDto[] };

// ---------------------------------------------------------------------------
// Production migration (Phase B) — HR Employee Self Service. Pure aggregation
// over already-real domains for the CALLER'S OWN Staff record — no new
// authorization model, identity-scoped exactly like the account self-service
// endpoints. Contract/document/training/announcement sections are added as
// their own real models land in later Phase B sub-batches.
// ---------------------------------------------------------------------------

export type HrSelfServiceDto = {
  staff: StaffDetailDto;
  todayAttendance: StaffAttendanceHistoryEntryDto | null;
  attendancePercent: StaffAttendancePercentDto;
  recentLeaveRequests: LeaveRequestDto[];
  // HR Sub-batch 2 — the caller's OWN contracts (compensationNote always
  // redacted here; self-service never implies hr.view/hr.manage) and OWN
  // documents where visibility is explicitly "staff-visible".
  contracts: ContractDto[];
  documents: StaffDocumentDto[];
  // HR Sub-batch 3 — the caller's OWN completed + explicitly visible
  // performance reviews, and OWN training assignments (read-only; hr.viewOwn
  // never lets the caller create/assign/complete anything here).
  performanceReviews: MyPerformanceReviewDto[];
  trainingAssignments: MyTrainingAssignmentDto[];
  // HR Sub-batch 4 — the caller's OWN onboarding (if any), every PUBLISHED
  // policy with the caller's own acknowledgement state (never a draft), and
  // the caller's own currently-effective shift, if assigned. Read-only —
  // hr.viewOwn never lets the caller manage recruitment/onboarding/policies/
  // shifts, only acknowledge a policy for themselves.
  onboarding: EmployeeOnboardingDto | null;
  policies: MyHrPolicyDto[];
  shift: MyShiftDto;
};
