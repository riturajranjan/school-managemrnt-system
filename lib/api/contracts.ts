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
export type CalendarSourceTypeDto = "manual" | "exam" | "homework" | "lesson-plan";

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

export type NotificationTypeDto = "lesson-plan-approved" | "lesson-plan-rejected" | "exam-scheduled" | "calendar-event" | "leave-request-submitted" | "leave-request-approved" | "leave-request-rejected" | "visitor-checked-in" | "message-received";

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

export type ActionCategoryDto = "lesson_plan" | "leave" | "marks" | "fees" | "payroll" | "visitor" | "communication";
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
export type JournalSourceTypeDto = "manual" | "fee_payment" | "fee_refund" | "payroll_payment";
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
