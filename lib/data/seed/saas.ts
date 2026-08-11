import type {
  MarketplaceItem, PlanFeature, PlatformAdminUser, PlatformRole, SaasAddon,
  SaasPlan, SaasState, SaasTenant, SaasTenantStatus, TenantDomain, TenantLifecycleStage,
} from "@/lib/types/saas";
import { seededHelpers } from "./rng";

const helpers = seededHelpers(14142026);
function daysAgo(n: number) { return helpers.daysAgoIso(n).slice(0, 10); }
function daysFromNow(n: number) { return helpers.daysFromNowIso(n).slice(0, 10); }
function isoTime(hoursAgo: number) { const d = new Date("2026-08-08T11:00:00Z"); d.setHours(d.getHours() - hoursAgo); return d.toISOString(); }

const FEATURE_KEYS = [
  "admissions", "attendance", "exams", "fees", "transport", "library", "hr", "communication", "hostel", "health", "cafeteria", "activities", "documents", "analytics",
];
const FEATURE_LABELS: Record<string, string> = {
  admissions: "Admissions", attendance: "Attendance", exams: "Exams", fees: "Fees", transport: "Transport", library: "Library",
  hr: "HR", communication: "Communication", hostel: "Hostel", health: "Health", cafeteria: "Cafeteria", activities: "Activities",
  documents: "Documents", analytics: "Analytics",
};

function planFeatures(tier: number): PlanFeature[] {
  return FEATURE_KEYS.map((key, i) => {
    let level: PlanFeature["level"];
    if (tier >= 3) level = "included";
    else if (tier === 2) level = i < 11 ? "included" : i < 13 ? "limited" : "add-on";
    else if (tier === 1) level = i < 7 ? "included" : i < 10 ? "limited" : "add-on";
    else level = i < 4 ? "included" : i < 6 ? "limited" : "not-available";
    return { key, label: FEATURE_LABELS[key], level };
  });
}

export function emptySaasState(): SaasState {
  const plans: SaasPlan[] = [
    { id: "plan-starter", name: "Starter", description: "For small schools getting started.", monthlyPrice: 4999, annualPrice: 49990, studentLimit: 300, staffLimit: 40, branchLimit: 1, storageGb: 5, supportLevel: "community", trialDays: 14, whiteLabel: false, customDomain: false, features: planFeatures(0), status: "active", tenantCount: 0 },
    { id: "plan-growth", name: "Growth", description: "Growing schools with multiple modules.", monthlyPrice: 12999, annualPrice: 129990, studentLimit: 1000, staffLimit: 120, branchLimit: 2, storageGb: 25, supportLevel: "standard", trialDays: 21, whiteLabel: false, customDomain: true, features: planFeatures(1), status: "active", tenantCount: 0, popular: true },
    { id: "plan-professional", name: "Professional", description: "Established institutions, all modules.", monthlyPrice: 24999, annualPrice: 249990, studentLimit: 2500, staffLimit: 300, branchLimit: 5, storageGb: 100, supportLevel: "priority", trialDays: 30, whiteLabel: true, customDomain: true, features: planFeatures(2), status: "active", tenantCount: 0 },
    { id: "plan-enterprise", name: "Enterprise", description: "Multi-branch groups, white-label, dedicated support.", monthlyPrice: 49999, annualPrice: 499990, studentLimit: 100000, staffLimit: 100000, branchLimit: 100, storageGb: 1000, supportLevel: "dedicated", trialDays: 30, whiteLabel: true, customDomain: true, features: planFeatures(3), status: "active", tenantCount: 0 },
  ];

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
    tenants: [], plans, overrides: [], addons, marketplace,
    domains: [], success: [], announcements: [], status: [], auditLog: [], admins: [],
    settings: { platformName: "Novyra Campus OS", supportContact: "platform@novyra.io", defaultTrialDays: 21, defaultPlanId: "plan-growth", defaultBillingCycle: "monthly", gracePeriodDays: 7, maintenanceMessage: "We'll be back shortly.", legalLinks: [{ label: "Master Services Agreement", url: "/legal/msa" }, { label: "Data Processing Addendum", url: "/legal/dpa" }] },
  };
}

const TENANT_NAMES = [
  "Greenwood International", "St. Xavier's High", "Delhi Public Academy", "Sunrise Global School", "Oakridge Montessori",
  "Riverside Grammar", "Heritage Valley School", "Blue Bells Public", "Nalanda Vidyalaya", "Mount Carmel Convent",
  "Sapphire World School", "Vidya Niketan", "Everest Academy", "Lotus Valley International",
];

export function buildSaasData(): SaasState {
  const base = emptySaasState();
  const planIds = base.plans.map((p) => p.id);
  const regions = ["India · North", "India · South", "India · West", "India · East", "UAE"];

  const statuses: SaasTenantStatus[] = ["active", "active", "active", "active", "trial", "trial", "payment-due", "grace-period", "setup-pending", "suspended", "active", "active", "inactive", "trial"];
  const stages: TenantLifecycleStage[] = ["growth", "renewal", "expansion", "activated", "trial", "trial", "payment-issue", "payment-issue", "setup", "suspended", "growth", "activated", "churned", "trial"];

  const tenants: SaasTenant[] = TENANT_NAMES.map((name, i) => {
    const planId = planIds[i % planIds.length];
    const plan = base.plans.find((p) => p.id === planId)!;
    const status = statuses[i];
    const students = status === "setup-pending" ? helpers.int(0, 40) : helpers.int(120, Math.min(plan.studentLimit, 2400));
    return {
      id: `ten-${i + 1}`, name, code: name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 4) + (i + 1),
      domain: `${name.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "")}.novyra.app`,
      logoColor: `hsl(${(i * 47) % 360} 55% 50%)`, planId, status, stage: stages[i],
      ownerName: helpers.pick(["Rajesh Kumar", "Meera Nair", "Anil Kapoor", "Sunita Reddy", "Farhan Khan", "Priya Menon"]),
      ownerEmail: `admin@${name.toLowerCase().replace(/[^a-z]+/g, "")}.edu`, region: regions[i % regions.length],
      students, staff: Math.round(students / 15) + helpers.int(2, 8), branches: Math.min(plan.branchLimit, helpers.int(1, 4)),
      setupPercent: status === "setup-pending" ? helpers.int(20, 60) : helpers.int(75, 100), usagePercent: helpers.int(35, 98),
      supportOpen: helpers.int(0, 3), createdAt: daysAgo(helpers.int(10, 420)), lastActive: status === "inactive" ? daysAgo(helpers.int(40, 90)) : isoTime(helpers.int(1, 200)),
      whiteLabel: { enabled: plan.whiteLabel && helpers.bool(0.5), hidePlatformLogo: false, loginBranding: plan.whiteLabel, accentColor: "#18b0c8", emailBranding: false, documentBranding: plan.whiteLabel },
      notes: helpers.bool(0.4) ? [{ id: `note-${i}`, at: daysAgo(helpers.int(1, 30)), by: "Customer Success", text: helpers.pick(["Onboarding call scheduled.", "Interested in transport add-on.", "Migrating from legacy ERP.", "Renewal discussion pending."]) }] : [],
    };
  });
  base.plans.forEach((p) => { p.tenantCount = tenants.filter((t) => t.planId === p.id).length; });

  // NOTE: mock subscriptions removed in SA-4F (real Subscription model + health).

  // NOTE: mock usage removed in SA-4G (real usage-service derives usage vs Plan limits).

  // NOTE: mock invoices removed in SA-4H (real Invoice model + server-side Global Search).

  // Domains
  const domains: TenantDomain[] = tenants.flatMap((t, i) => {
    const list: TenantDomain[] = [{ id: `dom-sub-${i}`, tenantId: t.id, domain: t.domain, type: "subdomain", status: "active", sslStatus: "active", lastChecked: isoTime(helpers.int(1, 48)) }];
    if (helpers.bool(0.4)) {
      const cs: TenantDomain["status"] = helpers.pick(["setup-required", "verification-pending", "active", "error"]);
      list.push({ id: `dom-cus-${i}`, tenantId: t.id, domain: `portal.${t.name.toLowerCase().replace(/[^a-z]+/g, "")}.edu`, type: "custom", status: cs, sslStatus: cs === "active" ? "active" : cs === "verification-pending" ? "pending" : "none", lastChecked: isoTime(helpers.int(1, 72)) });
    }
    return list;
  });

  // NOTE: mock support tickets removed in SA-4I (real SupportTicket model + API).

  // Customer success
  base.success = tenants.map((t) => ({ tenantId: t.id, onboardingPercent: t.setupPercent, adoptionPercent: helpers.int(30, 95), trainingCompleted: helpers.int(0, 5), upcomingReview: helpers.bool(0.4) ? daysFromNow(helpers.int(3, 30)) : undefined, expansionOpportunity: helpers.bool(0.35) ? helpers.pick(["Transport add-on", "Extra branch", "Upgrade to Professional", "White-label"]) : undefined }));

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
  base.auditLog = Array.from({ length: 30 }, (_, i) => ({ id: `pa-${i}`, admin: helpers.pick(["Platform Owner", "Billing Admin", "Support Admin", "Super Admin"]), action: helpers.pick(actions), tenantName: helpers.pick(tenants).name, module: helpers.pick(["Schools", "Plans", "Billing", "Support", "Domains"]), timestamp: isoTime(helpers.int(0, 400)), result: helpers.rand() < 0.9 ? "success" : "denied" }));

  // Platform admins
  const adminRoles: { role: PlatformRole; name: string; status: PlatformAdminUser["status"] }[] = [
    { role: "platform-owner", name: "Aditya Rao", status: "active" }, { role: "super-admin", name: "System Admin", status: "active" },
    { role: "billing-admin", name: "Neha Shah", status: "active" }, { role: "support-admin", name: "Ravi Kumar", status: "active" },
    { role: "customer-success", name: "Nisha Verma", status: "active" }, { role: "auditor", name: "External Auditor", status: "invited" },
  ];
  base.admins = adminRoles.map((a, i) => ({ id: `padm-${i}`, name: a.name, email: `${a.name.toLowerCase().replace(/[^a-z]+/g, ".")}@novyra.io`, role: a.role, lastActive: a.status === "invited" ? "—" : isoTime(helpers.int(1, 120)), status: a.status, scope: a.role === "platform-owner" || a.role === "super-admin" ? "All tenants" : a.role === "billing-admin" ? "Billing & invoices" : a.role === "auditor" ? "Read-only" : "Assigned tenants", photoColor: `hsl(${(i * 61) % 360} 55% 55%)` }));

  base.tenants = tenants;
  base.domains = domains;
  return base;
}
