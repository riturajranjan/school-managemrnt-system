import type { ID, StatusTone } from "./common";

// ===========================================================================
// Phase 14 — Multi-School Super Admin / SaaS Control Center. Frontend mock
// models only. No real billing, subscriptions, tenant provisioning, usage
// metering, domains, webhooks, auth impersonation or integrations. Everything
// is typed mock state grouped under a single SaasState object on the store.
// ===========================================================================

export type SaasTenantStatus = "trial" | "active" | "payment-due" | "grace-period" | "suspended" | "setup-pending" | "inactive" | "archived";

export const tenantStatusLabels: Record<SaasTenantStatus, string> = {
  trial: "Trial", active: "Active", "payment-due": "Payment due", "grace-period": "Grace period",
  suspended: "Suspended", "setup-pending": "Setup pending", inactive: "Inactive", archived: "Archived",
};

export const tenantStatusTone: Record<SaasTenantStatus, StatusTone> = {
  trial: "info", active: "success", "payment-due": "warning", "grace-period": "warning",
  suspended: "error", "setup-pending": "warning", inactive: "neutral", archived: "neutral",
};

export type TenantLifecycleStage = "lead" | "trial" | "setup" | "activated" | "growth" | "renewal" | "expansion" | "payment-issue" | "suspended" | "churned";

export const lifecycleLabels: Record<TenantLifecycleStage, string> = {
  lead: "Lead", trial: "Trial", setup: "Setup", activated: "Activated", growth: "Growth", renewal: "Renewal",
  expansion: "Expansion", "payment-issue": "Payment issue", suspended: "Suspended", churned: "Churned",
};

export const lifecycleOrder: TenantLifecycleStage[] = ["lead", "trial", "setup", "activated", "growth", "renewal", "expansion"];

export type WhiteLabelSettings = {
  enabled: boolean;
  hidePlatformLogo: boolean;
  loginBranding: boolean;
  accentColor: string;
  emailBranding: boolean;
  documentBranding: boolean;
};

export type SaasTenant = {
  id: ID;
  name: string;
  code: string;
  domain: string;
  logoColor: string;
  planId: ID;
  status: SaasTenantStatus;
  stage: TenantLifecycleStage;
  ownerName: string;
  ownerEmail: string;
  region: string;
  students: number;
  staff: number;
  branches: number;
  setupPercent: number;
  usagePercent: number;
  supportOpen: number;
  createdAt: string;
  lastActive: string;
  whiteLabel: WhiteLabelSettings;
  notes: { id: ID; at: string; by: string; text: string }[];
};

// ---------------------------------------------------------------------------
// Plans & entitlements
// ---------------------------------------------------------------------------

export type PlanStatus = "draft" | "active" | "hidden" | "archived";

export type EntitlementLevel = "included" | "limited" | "add-on" | "not-available";

export const entitlementLabels: Record<EntitlementLevel, string> = {
  included: "Included", limited: "Limited", "add-on": "Add-on", "not-available": "Not available",
};

export const entitlementTone: Record<EntitlementLevel, StatusTone> = {
  included: "success", limited: "info", "add-on": "warning", "not-available": "neutral",
};

export type PlanFeature = { key: string; label: string; level: EntitlementLevel };

export type SaasPlan = {
  id: ID;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  studentLimit: number;
  staffLimit: number;
  branchLimit: number;
  storageGb: number;
  supportLevel: "community" | "standard" | "priority" | "dedicated";
  trialDays: number;
  whiteLabel: boolean;
  customDomain: boolean;
  features: PlanFeature[];
  status: PlanStatus;
  tenantCount: number;
  popular?: boolean;
};

// Per-tenant override of a feature entitlement.
export type TenantFeatureOverride = {
  id: ID;
  tenantId: ID;
  featureKey: string;
  level: EntitlementLevel;
  reason: string;
  setBy: string;
  at: string;
};

// ---------------------------------------------------------------------------
// Subscriptions, invoices, payments
// ---------------------------------------------------------------------------

// NOTE: the mock subscription types (SubscriptionStatus/subscriptionStatusLabels/
// subscriptionStatusTone/TenantSubscription) and the `db.saas.subscriptions` slice
// were removed in Super Admin Phase SA-4F — subscriptions + tenant health are real
// (Subscription model + /api/super-admin/subscriptions, health-service).

// NOTE: the mock invoice types (InvoiceStatus/invoiceStatusLabels/
// invoiceStatusTone/SaasInvoiceItem/SaasInvoice) and the `db.saas.invoices` slice
// were removed in Super Admin Phase SA-4H — invoices are real (Invoice model +
// /api/super-admin/invoices) and Global Search is server-side.

// NOTE: the mock platform-payment types (PaymentStatus/paymentStatusLabels/
// paymentStatusTone/SaasPayment) and the `db.saas.payments` slice were removed in
// Super Admin Phase SA-4E — payments are now real (Payment model + /api/super-admin/payments).

// ---------------------------------------------------------------------------
// Usage
// ---------------------------------------------------------------------------

// NOTE: the mock usage types (UsageKey/usageKeyLabels/usageKeyUnit/
// TenantUsageMetric) and the `db.saas.usage` slice were removed in Super Admin
// Phase SA-4G — usage & limits are real now (derived live vs Plan limits,
// usage-service + /api/super-admin/usage).

// ---------------------------------------------------------------------------
// Add-ons & marketplace
// ---------------------------------------------------------------------------

export type SaasAddon = {
  id: ID;
  name: string;
  description: string;
  category: string;
  priceMinor: number;
  unit: string;
  includedLimit: string;
  glyph: string;
};

export type MarketplaceItem = {
  id: ID;
  name: string;
  provider: string;
  category: "communication" | "payments" | "gps" | "storage" | "ai" | "analytics" | "productivity" | "learning" | "other";
  description: string;
  compatibility: string;
  status: "available" | "coming-soon" | "enabled";
  glyph: string;
};

export const marketplaceStatusLabels: Record<MarketplaceItem["status"], string> = {
  available: "Available", "coming-soon": "Coming soon", enabled: "Enabled",
};

// ---------------------------------------------------------------------------
// Domains
// ---------------------------------------------------------------------------

export type DomainStatus = "setup-required" | "verification-pending" | "active" | "error";

export const domainStatusLabels: Record<DomainStatus, string> = {
  "setup-required": "Setup required", "verification-pending": "Verification pending", active: "Active", error: "Error",
};

export const domainStatusTone: Record<DomainStatus, StatusTone> = {
  "setup-required": "neutral", "verification-pending": "warning", active: "success", error: "error",
};

export type TenantDomain = {
  id: ID;
  tenantId: ID;
  domain: string;
  type: "subdomain" | "custom";
  status: DomainStatus;
  sslStatus: "none" | "pending" | "active";
  lastChecked: string;
};

// ---------------------------------------------------------------------------
// Support & customer success
// ---------------------------------------------------------------------------

export type SupportCategory = "setup" | "billing" | "product" | "technical" | "training" | "migration" | "integration" | "other";

export const supportCategoryLabels: Record<SupportCategory, string> = {
  setup: "Setup", billing: "Billing", product: "Product", technical: "Technical", training: "Training",
  migration: "Migration", integration: "Integration", other: "Other",
};

export type SupportPriority = "low" | "normal" | "high" | "urgent";
export type SupportTicketStatus = "open" | "in-progress" | "waiting" | "escalated" | "resolved" | "closed";

export const supportStatusTone: Record<SupportTicketStatus, StatusTone> = {
  open: "info", "in-progress": "warning", waiting: "neutral", escalated: "error", resolved: "success", closed: "neutral",
};

export type PlatformSupportTicket = {
  id: ID;
  reference: string;
  tenantId: ID;
  subject: string;
  category: SupportCategory;
  priority: SupportPriority;
  assignedTo: string;
  status: SupportTicketStatus;
  lastActivity: string;
  createdAt: string;
  messages: { id: ID; author: string; internal: boolean; at: string; text: string }[];
};

export type CustomerSuccessRecord = {
  tenantId: ID;
  onboardingPercent: number;
  adoptionPercent: number;
  trainingCompleted: number;
  upcomingReview?: string;
  expansionOpportunity?: string;
};

// ---------------------------------------------------------------------------
// Announcements, status, audit, admins, settings
// ---------------------------------------------------------------------------

export type AnnouncementType = "product-update" | "maintenance" | "security" | "billing" | "policy" | "feature-release";

export const announcementTypeLabels: Record<AnnouncementType, string> = {
  "product-update": "Product update", maintenance: "Maintenance", security: "Security notice",
  billing: "Billing", policy: "Policy", "feature-release": "Feature release",
};

export type PlatformAnnouncement = {
  id: ID;
  title: string;
  type: AnnouncementType;
  audience: string;
  body: string;
  publishedAt: string;
  status: "draft" | "scheduled" | "published";
};

export type PlatformStatusItem = {
  id: string;
  service: string;
  state: "demo" | "operational" | "degraded" | "maintenance";
  note: string;
};

export const platformStatusLabels: Record<PlatformStatusItem["state"], string> = {
  demo: "Demo", operational: "Operational", degraded: "Degraded", maintenance: "Maintenance",
};

export const platformStatusTone: Record<PlatformStatusItem["state"], StatusTone> = {
  demo: "info", operational: "success", degraded: "warning", maintenance: "warning",
};

export type PlatformAuditEntry = {
  id: ID;
  admin: string;
  action: string;
  tenantName: string;
  module: string;
  timestamp: string;
  result: "success" | "denied";
};

export type PlatformRole = "platform-owner" | "super-admin" | "billing-admin" | "support-admin" | "customer-success" | "auditor";

export const platformRoleLabels: Record<PlatformRole, string> = {
  "platform-owner": "Platform Owner", "super-admin": "Super Admin", "billing-admin": "Billing Admin",
  "support-admin": "Support Admin", "customer-success": "Customer Success", auditor: "Read-only Auditor",
};

export type PlatformAdminUser = {
  id: ID;
  name: string;
  email: string;
  role: PlatformRole;
  lastActive: string;
  status: "active" | "invited" | "suspended";
  scope: string;
  photoColor: string;
};

export type PlatformArea = "schools" | "plans" | "billing" | "support" | "domains" | "marketplace" | "announcements" | "settings" | "audit";

export type PlatformSettings = {
  platformName: string;
  supportContact: string;
  defaultTrialDays: number;
  defaultPlanId: ID;
  defaultBillingCycle: "monthly" | "annual";
  gracePeriodDays: number;
  maintenanceMessage: string;
  legalLinks: { label: string; url: string }[];
};

// ---------------------------------------------------------------------------
// Grouped state on the store
// ---------------------------------------------------------------------------

export type SaasState = {
  tenants: SaasTenant[];
  plans: SaasPlan[];
  overrides: TenantFeatureOverride[];
  addons: SaasAddon[];
  marketplace: MarketplaceItem[];
  domains: TenantDomain[];
  support: PlatformSupportTicket[];
  success: CustomerSuccessRecord[];
  announcements: PlatformAnnouncement[];
  status: PlatformStatusItem[];
  auditLog: PlatformAuditEntry[];
  admins: PlatformAdminUser[];
  settings: PlatformSettings;
};
