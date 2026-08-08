import type { ID, StatusTone } from "./common";
import type { UserRole } from "@/lib/permissions/roles";

// ===========================================================================
// Phase 13 — Administration & System Configuration. Frontend mock models only.
// No database, no real auth/RBAC enforcement, no real integrations, backups,
// webhooks or persistent settings. Everything here is typed mock state grouped
// under a single AdminState object on the store.
// ===========================================================================

// ---------------------------------------------------------------------------
// Organization
// ---------------------------------------------------------------------------

export type SchoolProfile = {
  name: string;
  shortName: string;
  code: string;
  schoolType: string;
  board: string;
  establishedYear: number;
  registrationNumber: string;
  affiliationNumber: string;
  website: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  timeZone: string;
  defaultLanguage: string;
  currency: string;
  // Branding asset placeholders (labels only — no real uploads).
  logoLabel: string;
  darkLogoLabel: string;
  faviconLabel: string;
  sealLabel: string;
  letterheadLabel: string;
};

export type BranchStatus = "active" | "setup-pending" | "inactive" | "archived";

export const branchStatusLabels: Record<BranchStatus, string> = {
  active: "Active", "setup-pending": "Setup pending", inactive: "Inactive", archived: "Archived",
};

export const branchStatusTone: Record<BranchStatus, StatusTone> = {
  active: "success", "setup-pending": "warning", inactive: "neutral", archived: "neutral",
};

export type SchoolBranch = {
  id: ID;
  name: string;
  code: string;
  address: string;
  city: string;
  contact: string;
  headName: string;
  session: string;
  studentCount: number;
  staffCount: number;
  classesCount: number;
  modulesEnabled: number;
  status: BranchStatus;
  completeness: number; // 0-100 config completeness
  isPrimary: boolean;
};

export type SessionStatus = "draft" | "upcoming" | "active" | "closed" | "archived";

export const sessionStatusLabels: Record<SessionStatus, string> = {
  draft: "Draft", upcoming: "Upcoming", active: "Active", closed: "Closed", archived: "Archived",
};

export const sessionStatusTone: Record<SessionStatus, StatusTone> = {
  draft: "neutral", upcoming: "info", active: "success", closed: "warning", archived: "neutral",
};

export type AcademicSessionSetting = {
  id: ID;
  name: string;
  startDate: string;
  endDate: string;
  admissionStart: string;
  examPeriod: string;
  feePeriod: string;
  status: SessionStatus;
};

// ---------------------------------------------------------------------------
// Users & access
// ---------------------------------------------------------------------------

export type SystemUserStatus = "active" | "invited" | "suspended" | "locked" | "inactive";

export const systemUserStatusLabels: Record<SystemUserStatus, string> = {
  active: "Active", invited: "Invited", suspended: "Suspended", locked: "Locked", inactive: "Inactive",
};

export const systemUserStatusTone: Record<SystemUserStatus, StatusTone> = {
  active: "success", invited: "info", suspended: "warning", locked: "error", inactive: "neutral",
};

export type SystemUser = {
  id: ID;
  name: string;
  email: string;
  role: UserRole;
  branch: string;
  lastActive: string;
  status: SystemUserStatus;
  accessLevel: "full" | "branch" | "scoped" | "read-only";
  photoColor: string;
};

export type AccessScopeKind = "all-schools" | "selected-school" | "selected-branches" | "own-branch" | "assigned-classes" | "assigned-sections" | "assigned-subjects" | "own-records";

export const accessScopeLabels: Record<AccessScopeKind, string> = {
  "all-schools": "All schools", "selected-school": "Selected school", "selected-branches": "Selected branches",
  "own-branch": "Own branch", "assigned-classes": "Assigned classes", "assigned-sections": "Assigned sections",
  "assigned-subjects": "Assigned subjects", "own-records": "Own records only",
};

export type RoleMeta = {
  role: UserRole;
  description: string;
  scope: AccessScopeKind;
  isSystem: boolean;
  status: "active" | "archived";
};

// ---------------------------------------------------------------------------
// Approval workflows
// ---------------------------------------------------------------------------

export type WorkflowStep = {
  id: ID;
  order: number;
  role: UserRole;
  label: string;
  required: boolean;
  escalation?: string;
};

export type ApprovalWorkflow = {
  id: ID;
  name: string;
  module: string;
  description: string;
  steps: WorkflowStep[];
  status: "active" | "draft" | "inactive";
};

// ---------------------------------------------------------------------------
// Custom fields & statuses
// ---------------------------------------------------------------------------

export type CustomFieldType = "text" | "number" | "date" | "dropdown" | "multi-select" | "checkbox" | "radio" | "textarea" | "email" | "phone" | "url";

export const customFieldTypeLabels: Record<CustomFieldType, string> = {
  text: "Text", number: "Number", date: "Date", dropdown: "Dropdown", "multi-select": "Multi-select",
  checkbox: "Checkbox", radio: "Radio", textarea: "Textarea", email: "Email", phone: "Phone", url: "URL",
};

export type CustomFieldDefinition = {
  id: ID;
  label: string;
  key: string;
  module: string;
  type: CustomFieldType;
  required: boolean;
  options: string[];
  helpText: string;
  visibility: "everyone" | "staff" | "admin";
  order: number;
  status: "active" | "inactive";
};

export type CustomStatusDefinition = {
  id: ID;
  name: string;
  color: string;
  order: number;
  module: string;
  terminal: boolean;
  active: boolean;
  isProtected: boolean; // core statuses cannot be edited in the simulation
};

// ---------------------------------------------------------------------------
// Branding, theme, localization
// ---------------------------------------------------------------------------

export type SchoolTheme = "default" | "ocean-campus" | "campus-green" | "royal-indigo" | "warm-academic" | "minimal-monochrome";

export const schoolThemeLabels: Record<SchoolTheme, string> = {
  default: "Novyra Default", "ocean-campus": "Ocean Campus", "campus-green": "Campus Green",
  "royal-indigo": "Royal Indigo", "warm-academic": "Warm Academic", "minimal-monochrome": "Minimal Monochrome",
};

export const schoolThemeColors: Record<SchoolTheme, { primary: string; secondary: string; accent: string }> = {
  default: { primary: "#18b0c8", secondary: "#022c43", accent: "#0891b2" },
  "ocean-campus": { primary: "#0ea5e9", secondary: "#0c4a6e", accent: "#06b6d4" },
  "campus-green": { primary: "#16a34a", secondary: "#14532d", accent: "#22c55e" },
  "royal-indigo": { primary: "#6366f1", secondary: "#312e81", accent: "#818cf8" },
  "warm-academic": { primary: "#d97706", secondary: "#7c2d12", accent: "#f59e0b" },
  "minimal-monochrome": { primary: "#475569", secondary: "#1e293b", accent: "#64748b" },
};

export type BrandingSettings = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  sidebarStyle: "gradient" | "solid" | "minimal";
  loginStyle: "split" | "centered" | "card";
  keepDefaultSidebar: boolean;
  logoLabel: string;
  darkLogoLabel: string;
  faviconLabel: string;
  sealLabel: string;
};

export type ThemeMode = "light" | "dark" | "system";

export type ThemeSettings = {
  mode: ThemeMode;
  schoolTheme: SchoolTheme;
};

export type LocalizationSettings = {
  defaultLanguage: string;
  enabledLanguages: { code: string; label: string; enabled: boolean }[];
  dateFormat: string;
  timeFormat: "12h" | "24h";
  weekStart: "sunday" | "monday";
  numberFormat: "indian" | "international";
  currency: string;
  timeZone: string;
};

export type RegionalSettings = {
  country: string;
  state: string;
  timeZone: string;
  currency: string;
  academicYearFormat: string;
  financialYear: string;
  dateFormat: string;
  timeFormat: "12h" | "24h";
  firstDayOfWeek: "sunday" | "monday";
  phoneFormat: string;
};

export type NumberingRule = {
  id: ID;
  name: string;
  entity: string;
  prefix: string;
  includeBranch: boolean;
  includeYear: boolean;
  includeSession: boolean;
  separator: "/" | "-" | ".";
  sequenceLength: number;
  nextSequence: number;
};

// ---------------------------------------------------------------------------
// Notification, communication, integrations
// ---------------------------------------------------------------------------

export type NotificationChannel = "in-app" | "push" | "email" | "sms" | "whatsapp";

export const notificationChannelLabels: Record<NotificationChannel, string> = {
  "in-app": "In-app", push: "Push", email: "Email", sms: "SMS", whatsapp: "WhatsApp",
};

// Only in-app is live; the rest need an integration.
export const channelRequiresIntegration: Record<NotificationChannel, boolean> = {
  "in-app": false, push: true, email: true, sms: true, whatsapp: true,
};

export type NotificationSetting = {
  module: string;
  channels: Record<NotificationChannel, boolean>;
};

export type CommunicationSetting = {
  senderName: string;
  defaultLanguage: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  digestEnabled: boolean;
  emergencyOverride: boolean;
  parentPolicy: string;
  teacherHoursStart: string;
  teacherHoursEnd: string;
};

export type IntegrationCategory = "payments" | "communication" | "storage" | "gps" | "accounting" | "video" | "identity" | "analytics" | "ai" | "other";

export const integrationCategoryLabels: Record<IntegrationCategory, string> = {
  payments: "Payments", communication: "Communication", storage: "Storage", gps: "GPS", accounting: "Accounting",
  video: "Video", identity: "Identity", analytics: "Analytics", ai: "AI", other: "Other",
};

export type IntegrationStatus = "not-connected" | "demo-placeholder";

export type IntegrationPlaceholder = {
  id: ID;
  name: string;
  category: IntegrationCategory;
  description: string;
  capabilities: string[];
  requiredSetup: string[];
  status: IntegrationStatus;
  logoGlyph: string;
};

// ---------------------------------------------------------------------------
// Modules & feature flags
// ---------------------------------------------------------------------------

export type ModuleSetting = {
  id: string;
  label: string;
  enabled: boolean;
  order: number;
  roleVisibility: "everyone" | "staff" | "admin";
  branchAvailable: boolean;
};

export type FeatureState = "enabled" | "disabled" | "beta" | "coming-soon";

export const featureStateLabels: Record<FeatureState, string> = {
  enabled: "Enabled", disabled: "Disabled", beta: "Beta", "coming-soon": "Coming soon",
};

export const featureStateTone: Record<FeatureState, StatusTone> = {
  enabled: "success", disabled: "neutral", beta: "info", "coming-soon": "warning",
};

export type FeatureFlag = {
  id: string;
  label: string;
  description: string;
  state: FeatureState;
};

// ---------------------------------------------------------------------------
// Security, audit, data, system health
// ---------------------------------------------------------------------------

export type SecuritySetting = {
  key: string;
  label: string;
  description: string;
  value: string;
  backendRequired: boolean;
  enabled: boolean;
};

export type AuditLogEntry = {
  id: ID;
  timestamp: string;
  actor: string;
  role: string;
  module: string;
  action: string;
  record: string;
  branch: string;
  status: "success" | "denied" | "warning";
  previousValue?: string;
  newValue?: string;
  reason?: string;
};

export type ImportJobMock = {
  id: ID;
  module: string;
  fileName: string;
  rows: number;
  valid: number;
  errors: number;
  status: "mapping" | "validated" | "completed" | "failed";
  createdAt: string;
};

export type ExportJobMock = {
  id: ID;
  module: string;
  format: "csv" | "xlsx" | "pdf";
  rows: number;
  status: "ready" | "generating" | "completed";
  createdAt: string;
};

export type BackupMock = {
  id: ID;
  label: string;
  sizeMb: number;
  createdAt: string;
  type: "manual" | "scheduled";
  status: "available" | "restoring";
};

export type SystemHealthItem = {
  id: string;
  label: string;
  category: string;
  state: "demo" | "not-configured" | "ready-for-integration";
  note: string;
};

export const systemHealthStateLabels: Record<SystemHealthItem["state"], string> = {
  demo: "Demo", "not-configured": "Not configured", "ready-for-integration": "Ready for integration",
};

export const systemHealthStateTone: Record<SystemHealthItem["state"], StatusTone> = {
  demo: "info", "not-configured": "neutral", "ready-for-integration": "warning",
};

// ---------------------------------------------------------------------------
// Policies & legal
// ---------------------------------------------------------------------------

export type SchoolPolicy = {
  id: ID;
  name: string;
  version: string;
  effectiveDate: string;
  audience: string;
  acknowledged: number; // mock %
  status: "published" | "draft" | "archived";
};

export type LegalDocument = {
  id: ID;
  title: string;
  kind: "privacy" | "terms" | "parent-consent" | "student-aup" | "staff-it";
  version: string;
  updatedAt: string;
  body: string;
  status: "published" | "draft";
};

// ---------------------------------------------------------------------------
// Grouped admin state on the store
// ---------------------------------------------------------------------------

export type AdminState = {
  schoolProfile: SchoolProfile;
  branches: SchoolBranch[];
  sessions: AcademicSessionSetting[];
  users: SystemUser[];
  roles: RoleMeta[];
  workflows: ApprovalWorkflow[];
  customFields: CustomFieldDefinition[];
  customStatuses: CustomStatusDefinition[];
  branding: BrandingSettings;
  theme: ThemeSettings;
  localization: LocalizationSettings;
  regional: RegionalSettings;
  numbering: NumberingRule[];
  notifications: NotificationSetting[];
  communication: CommunicationSetting;
  integrations: IntegrationPlaceholder[];
  modules: ModuleSetting[];
  features: FeatureFlag[];
  security: SecuritySetting[];
  auditLog: AuditLogEntry[];
  imports: ImportJobMock[];
  exports: ExportJobMock[];
  backups: BackupMock[];
  systemHealth: SystemHealthItem[];
  policies: SchoolPolicy[];
  legal: LegalDocument[];
};
