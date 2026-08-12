import type { ID, StatusTone } from "./common";

// ===========================================================================
// Phase 14 — Multi-School Super Admin / SaaS Control Center. Frontend mock
// models only. No real billing, subscriptions, tenant provisioning, usage
// metering, domains, webhooks, auth impersonation or integrations. Everything
// is typed mock state grouped under a single SaasState object on the store.
// ===========================================================================

// NOTE: the mock tenant types (SaasTenantStatus/tenantStatusLabels/tone,
// TenantLifecycleStage/lifecycleLabels/lifecycleOrder, WhiteLabelSettings,
// SaasTenant), the mock plan/entitlement types (PlanStatus, EntitlementLevel/
// entitlementLabels/tone, PlanFeature, SaasPlan, TenantFeatureOverride) and the
// CustomerSuccessRecord type — plus the `db.saas.tenants/plans/overrides/domains/
// success` slices — were removed in Super Admin Phase SA-4L. Schools, plans,
// feature entitlements, custom domains and branding are all REAL now (School /
// Plan / PlanFeature / SchoolFeatureOverride / SchoolDomain / SchoolBranding
// models + /api/super-admin/{schools,plans,features,domains,branding}).

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
// Domains — now REAL (SchoolDomain model + /api/super-admin/domains, SA-4L). The
// mock domain types (DomainStatus/domainStatusLabels/tone, TenantDomain) and the
// `db.saas.domains` slice were removed in SA-4L.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Support & customer success — support is REAL (SupportTicket model +
// /api/super-admin/support, SA-4I). The mock CustomerSuccessRecord type + the
// `db.saas.success` slice were removed in SA-4L.
// ---------------------------------------------------------------------------

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
  addons: SaasAddon[];
  marketplace: MarketplaceItem[];
  announcements: PlatformAnnouncement[];
  status: PlatformStatusItem[];
  auditLog: PlatformAuditEntry[];
  admins: PlatformAdminUser[];
  settings: PlatformSettings;
};
