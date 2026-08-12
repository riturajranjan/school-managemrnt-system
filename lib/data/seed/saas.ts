import type { PlatformAdminUser, PlatformRole, SaasState } from "@/lib/types/saas";
import { seededHelpers } from "./rng";

// Mock SaaS seed — the SHRINKING remainder for the not-yet-migrated System
// (Settings / Activity / Announcements / Status / Audit / Admins) pages. The
// tenant/plan/override/domain/success slices were deleted in SA-4L; the
// addons/marketplace slices were deleted in SA-4M (all REAL now).
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
  return {
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
