import type {
  MarketplaceItem, PlatformAdminUser, PlatformRole, SaasAddon, SaasState,
} from "@/lib/types/saas";
import { seededHelpers } from "./rng";

// Mock SaaS seed — the SHRINKING remainder for the not-yet-migrated Add-ons /
// Marketplace / System (Settings / Activity / Announcements / Status) pages.
// The tenant/plan/override/domain/success slices were deleted in SA-4L (schools,
// plans, feature entitlements, domains are all REAL now).
const helpers = seededHelpers(14142026);
function daysAgo(n: number) { return helpers.daysAgoIso(n).slice(0, 10); }
function daysFromNow(n: number) { return helpers.daysFromNowIso(n).slice(0, 10); }
function isoTime(hoursAgo: number) { const d = new Date("2026-08-08T11:00:00Z"); d.setHours(d.getHours() - hoursAgo); return d.toISOString(); }

// Illustrative school names for the mock activity log only (no tenant records).
const SCHOOL_NAMES = [
  "Greenwood International", "St. Xavier's High", "Delhi Public Academy", "Sunrise Global School",
  "Oakridge Montessori", "Riverside Grammar", "Heritage Valley School", "Blue Bells Public",
];

export function emptySaasState(): SaasState {
  const addons: SaasAddon[] = [
    { id: "add-branch", name: "Additional branch", description: "Add another branch to your plan.", category: "Capacity", priceMinor: 300000, unit: "per branch/mo", includedLimit: "1 branch", glyph: "🏫" },
    { id: "add-students", name: "Student capacity +500", description: "Increase your student seat limit.", category: "Capacity", priceMinor: 250000, unit: "per 500/mo", includedLimit: "+500 students", glyph: "🎓" },
    { id: "add-storage", name: "Storage +50GB", description: "Extra document & media storage.", category: "Capacity", priceMinor: 100000, unit: "per 50GB/mo", includedLimit: "+50 GB", glyph: "☁" },
    { id: "add-sms", name: "SMS package", description: "Transactional SMS credits.", category: "Communication", priceMinor: 150000, unit: "per 10k/mo", includedLimit: "10,000 SMS", glyph: "✉" },
    { id: "add-whatsapp", name: "WhatsApp package", description: "WhatsApp template messages.", category: "Communication", priceMinor: 200000, unit: "per 10k/mo", includedLimit: "10,000 messages", glyph: "W" },
    { id: "add-gps", name: "GPS devices", description: "Live vehicle tracking devices.", category: "Transport", priceMinor: 80000, unit: "per device/mo", includedLimit: "1 device", glyph: "G" },
    { id: "add-analytics", name: "Advanced analytics", description: "Cross-module analytics builder.", category: "Analytics", priceMinor: 400000, unit: "per mo", includedLimit: "All dashboards", glyph: "▲" },
    { id: "add-whitelabel", name: "White-label", description: "Remove platform branding.", category: "Branding", priceMinor: 500000, unit: "per mo", includedLimit: "Full white-label", glyph: "✦" },
    { id: "add-support", name: "Premium support", description: "Priority response & success manager.", category: "Support", priceMinor: 600000, unit: "per mo", includedLimit: "24×7 priority", glyph: "★" },
  ];

  const marketplace: MarketplaceItem[] = [
    { id: "mkt-razorpay", name: "Razorpay", provider: "Razorpay", category: "payments", description: "Collect fees via UPI, cards, netbanking.", compatibility: "Growth+", status: "available", glyph: "R" },
    { id: "mkt-stripe", name: "Stripe", provider: "Stripe", category: "payments", description: "International card payments.", compatibility: "Professional+", status: "available", glyph: "S" },
    { id: "mkt-whatsapp", name: "WhatsApp Business", provider: "Meta", category: "communication", description: "Template messaging to parents.", compatibility: "Growth+", status: "available", glyph: "W" },
    { id: "mkt-sms", name: "SMS Gateway", provider: "MSG91", category: "communication", description: "Transactional SMS.", compatibility: "All plans", status: "available", glyph: "M" },
    { id: "mkt-gps", name: "Fleet GPS", provider: "TrackPro", category: "gps", description: "Live bus tracking feed.", compatibility: "Professional+", status: "coming-soon", glyph: "G" },
    { id: "mkt-s3", name: "Object Storage", provider: "S3-compatible", category: "storage", description: "Document & media storage.", compatibility: "All plans", status: "available", glyph: "☁" },
    { id: "mkt-ai", name: "AI Assistant", provider: "Novyra AI", category: "ai", description: "Assistive drafting & summaries.", compatibility: "Enterprise", status: "coming-soon", glyph: "✦" },
    { id: "mkt-analytics", name: "Analytics Cloud", provider: "Novyra", category: "analytics", description: "Aggregate dashboards.", compatibility: "Professional+", status: "enabled", glyph: "▲" },
    { id: "mkt-zoom", name: "Video Classes", provider: "Zoom", category: "learning", description: "Online class scheduling.", compatibility: "Growth+", status: "coming-soon", glyph: "▶" },
  ];

  return {
    addons, marketplace,
    announcements: [], status: [], auditLog: [], admins: [],
    settings: { platformName: "Novyra Campus OS", supportContact: "platform@novyra.io", defaultTrialDays: 21, defaultPlanId: "plan-growth", defaultBillingCycle: "monthly", gracePeriodDays: 7, maintenanceMessage: "We'll be back shortly.", legalLinks: [{ label: "Master Services Agreement", url: "/legal/msa" }, { label: "Data Processing Addendum", url: "/legal/dpa" }] },
  };
}

export function buildSaasData(): SaasState {
  const base = emptySaasState();

  // NOTE: real modules (schools/plans/subscriptions/trials/billing/invoices/
  // payments/health/usage/search/support/dashboard/impersonation/features/
  // domains/branding) are backed by PostgreSQL — nothing mock here.

  // Announcements
  base.announcements = [
    { id: "ann-1", title: "New: Document Studio", type: "feature-release", audience: "All schools", body: "Generate ID cards, certificates and letters from one place.", publishedAt: daysAgo(3), status: "published" },
    { id: "ann-2", title: "Scheduled maintenance", type: "maintenance", audience: "All schools", body: "Platform maintenance window this Sunday 02:00–03:00 IST.", publishedAt: daysAgo(1), status: "published" },
    { id: "ann-3", title: "Security best practices", type: "security", audience: "Selected plans", body: "Enable two-factor authentication for admin accounts.", publishedAt: daysAgo(10), status: "published" },
    { id: "ann-4", title: "Pricing update for add-ons", type: "billing", audience: "All schools", body: "Add-on pricing revised effective next cycle.", publishedAt: daysFromNow(5), status: "scheduled" },
    { id: "ann-5", title: "Draft: Term 2 highlights", type: "product-update", audience: "Trial schools", body: "Draft announcement.", publishedAt: daysFromNow(7), status: "draft" },
  ];

  // Status
  base.status = [
    { id: "st-web", service: "Web application", state: "demo", note: "Running in demo mode." },
    { id: "st-db", service: "Database", state: "demo", note: "Frontend mock state only — no live database." },
    { id: "st-comm", service: "Communication", state: "maintenance", note: "SMS/Email/WhatsApp require provider integration." },
    { id: "st-pay", service: "Payments", state: "degraded", note: "No live payment gateway connected." },
    { id: "st-gps", service: "GPS tracking", state: "maintenance", note: "GPS provider not connected." },
    { id: "st-storage", service: "Storage", state: "operational", note: "Demo storage available." },
  ];

  // Audit
  const actions = ["Plan changed", "Trial extended", "Entitlement overridden", "School suspended", "Domain changed", "Admin access simulated", "Invoice marked paid", "School created"];
  base.auditLog = Array.from({ length: 30 }, (_, i) => ({ id: `pa-${i}`, admin: helpers.pick(["Platform Owner", "Billing Admin", "Support Admin", "Super Admin"]), action: helpers.pick(actions), tenantName: helpers.pick(SCHOOL_NAMES), module: helpers.pick(["Schools", "Plans", "Billing", "Support", "Domains"]), timestamp: isoTime(helpers.int(0, 400)), result: helpers.rand() < 0.9 ? "success" : "denied" }));

  // Platform admins
  const adminRoles: { role: PlatformRole; name: string; status: PlatformAdminUser["status"] }[] = [
    { role: "platform-owner", name: "Aditya Rao", status: "active" }, { role: "super-admin", name: "System Admin", status: "active" },
    { role: "billing-admin", name: "Neha Shah", status: "active" }, { role: "support-admin", name: "Ravi Kumar", status: "active" },
    { role: "customer-success", name: "Nisha Verma", status: "active" }, { role: "auditor", name: "External Auditor", status: "invited" },
  ];
  base.admins = adminRoles.map((a, i) => ({ id: `padm-${i}`, name: a.name, email: `${a.name.toLowerCase().replace(/[^a-z]+/g, ".")}@novyra.io`, role: a.role, lastActive: a.status === "invited" ? "—" : isoTime(helpers.int(1, 120)), status: a.status, scope: a.role === "platform-owner" || a.role === "super-admin" ? "All tenants" : a.role === "billing-admin" ? "Billing & invoices" : a.role === "auditor" ? "Read-only" : "Assigned tenants", photoColor: `hsl(${(i * 61) % 360} 55% 55%)` }));

  return base;
}
