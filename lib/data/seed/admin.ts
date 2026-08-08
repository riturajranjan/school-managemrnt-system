import type { Student } from "@/lib/types/students";
import type { Employee } from "@/lib/types/hr";
import type { AdminState, ModuleSetting, NotificationChannel } from "@/lib/types/admin";
import type { UserRole } from "@/lib/permissions/roles";
import { seededHelpers } from "./rng";

const helpers = seededHelpers(13132026);
function daysAgo(n: number) { return helpers.daysAgoIso(n).slice(0, 10); }
function isoTime(hoursAgo: number) { const d = new Date("2026-08-08T11:00:00Z"); d.setHours(d.getHours() - hoursAgo); return d.toISOString(); }

const MODULE_LIST: { id: string; label: string }[] = [
  { id: "admissions", label: "Admissions" }, { id: "students", label: "Students" }, { id: "academics", label: "Academics" },
  { id: "attendance", label: "Attendance" }, { id: "exams", label: "Exams" }, { id: "fees", label: "Fees" },
  { id: "transport", label: "Transport" }, { id: "library", label: "Library" }, { id: "hr", label: "HR" },
  { id: "communication", label: "Communication" }, { id: "hostel", label: "Hostel" }, { id: "health", label: "Health" },
  { id: "cafeteria", label: "Cafeteria" }, { id: "activities", label: "Activities" }, { id: "documents", label: "Documents" },
];

const NOTIFY_MODULES = ["Attendance", "Fees", "Exams", "Transport", "Library", "HR", "Communication", "Hostel", "Health", "System"];

function defaultBranding(): AdminState["branding"] {
  return { primaryColor: "#18b0c8", secondaryColor: "#022c43", accentColor: "#0891b2", sidebarStyle: "gradient", loginStyle: "split", keepDefaultSidebar: true, logoLabel: "novyra-logo.svg", darkLogoLabel: "novyra-logo-dark.svg", faviconLabel: "favicon.ico", sealLabel: "school-seal.png" };
}

export function emptyAdminState(): AdminState {
  return {
    schoolProfile: {
      name: "Novyra Public School", shortName: "Novyra", code: "NVX-001", schoolType: "Co-educational", board: "CBSE", establishedYear: 2005,
      registrationNumber: "REG/HR/2005/0142", affiliationNumber: "AFF-000-2015", website: "www.novyra.edu.in", email: "office@novyra.edu.in", phone: "+91 124 400 1200",
      address: "12 Vidya Marg, Sector 21", city: "Gurugram", state: "Haryana", country: "India", postalCode: "122001", timeZone: "Asia/Kolkata",
      defaultLanguage: "en", currency: "INR", logoLabel: "novyra-logo.svg", darkLogoLabel: "novyra-logo-dark.svg", faviconLabel: "favicon.ico", sealLabel: "school-seal.png", letterheadLabel: "letterhead.png",
    },
    branches: [], sessions: [], users: [], roles: [], workflows: [], customFields: [], customStatuses: [],
    branding: defaultBranding(),
    theme: { mode: "system", schoolTheme: "default" },
    localization: { defaultLanguage: "en", enabledLanguages: [{ code: "en", label: "English", enabled: true }, { code: "hi", label: "हिन्दी (Hindi)", enabled: true }], dateFormat: "DD MMM YYYY", timeFormat: "12h", weekStart: "monday", numberFormat: "indian", currency: "INR", timeZone: "Asia/Kolkata" },
    regional: { country: "India", state: "Haryana", timeZone: "Asia/Kolkata", currency: "INR", academicYearFormat: "YYYY-YYYY", financialYear: "April – March", dateFormat: "DD MMM YYYY", timeFormat: "12h", firstDayOfWeek: "monday", phoneFormat: "+91 ##### #####" },
    numbering: [], notifications: [], communication: { senderName: "Novyra Public School", defaultLanguage: "en", quietHoursStart: "21:00", quietHoursEnd: "07:00", digestEnabled: true, emergencyOverride: true, parentPolicy: "School hours only", teacherHoursStart: "08:00", teacherHoursEnd: "17:00" },
    integrations: [], modules: [], features: [], security: [], auditLog: [], imports: [], exports: [], backups: [], systemHealth: [], policies: [], legal: [],
  };
}

export function buildAdminData(students: Student[], employees: Employee[]): AdminState {
  const base = emptyAdminState();
  const activeStudents = students.filter((s) => s.status === "active").length;
  const staffCount = employees.length;

  base.branches = [
    { id: "br-main", name: "Main Campus", code: "MC", address: "12 Vidya Marg, Sector 21", city: "Gurugram", contact: "+91 124 400 1200", headName: "Dr. Meera Krishnan", session: "2026-2027", studentCount: Math.round(activeStudents * 0.7), staffCount: Math.round(staffCount * 0.7), classesCount: 13, modulesEnabled: 15, status: "active", completeness: 96, isPrimary: true },
    { id: "br-north", name: "North Wing (Primary)", code: "NW", address: "45 Green Avenue", city: "Gurugram", contact: "+91 124 400 1250", headName: "Ms. Kavita Nambiar", session: "2026-2027", studentCount: Math.round(activeStudents * 0.3), staffCount: Math.round(staffCount * 0.3), classesCount: 6, modulesEnabled: 12, status: "active", completeness: 82, isPrimary: false },
    { id: "br-east", name: "East Campus (New)", code: "EC", address: "Plot 9, Tech Park Rd", city: "Faridabad", contact: "+91 129 220 4400", headName: "—", session: "2026-2027", studentCount: 0, staffCount: 4, classesCount: 0, modulesEnabled: 6, status: "setup-pending", completeness: 34, isPrimary: false },
  ];

  base.sessions = [
    { id: "ses-2627", name: "2026-2027", startDate: "2026-04-01", endDate: "2027-03-31", admissionStart: "2025-11-01", examPeriod: "Sep 2026 · Mar 2027", feePeriod: "Quarterly", status: "active" },
    { id: "ses-2728", name: "2027-2028", startDate: "2027-04-01", endDate: "2028-03-31", admissionStart: "2026-11-01", examPeriod: "TBD", feePeriod: "Quarterly", status: "upcoming" },
    { id: "ses-2526", name: "2025-2026", startDate: "2025-04-01", endDate: "2026-03-31", admissionStart: "2024-11-01", examPeriod: "Completed", feePeriod: "Quarterly", status: "closed" },
  ];

  // System users — pull a few real employees + representative role accounts.
  const roleAccounts: { role: UserRole; name: string; branch: string; level: SystemAccessLevel; status: AdminUserStatus }[] = [
    { role: "super-admin", name: "System Administrator", branch: "All branches", level: "full", status: "active" },
    { role: "principal", name: "Dr. Meera Krishnan", branch: "Main Campus", level: "branch", status: "active" },
    { role: "administrator", name: "Ms. Kavya Iyer", branch: "Main Campus", level: "branch", status: "active" },
    { role: "hr-manager", name: "Mr. Sanjay Rao", branch: "Main Campus", level: "scoped", status: "active" },
    { role: "accountant", name: "Ms. Divya Menon", branch: "Main Campus", level: "scoped", status: "active" },
    { role: "librarian", name: "Ms. Priya Nair", branch: "Main Campus", level: "scoped", status: "active" },
    { role: "transport-manager", name: "Mr. Arjun Pillai", branch: "Main Campus", level: "scoped", status: "invited" },
    { role: "teacher", name: "Ms. Ananya Sharma", branch: "North Wing", level: "scoped", status: "active" },
    { role: "teacher", name: "Mr. Rohit Verma", branch: "Main Campus", level: "scoped", status: "suspended" },
    { role: "parent", name: "Mr. Suresh Gupta", branch: "Main Campus", level: "read-only", status: "active" },
    { role: "examination-controller", name: "Mrs. Anjali Desai", branch: "Main Campus", level: "scoped", status: "locked" },
  ];
  base.users = roleAccounts.map((a, i) => ({ id: `usr-${i}`, name: a.name, email: `${a.name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@novyra.edu.in`, role: a.role, branch: a.branch, lastActive: a.status === "invited" ? "—" : isoTime(helpers.int(1, 240)), status: a.status, accessLevel: a.level, photoColor: `hsl(${(i * 53) % 360} 55% 55%)` }));

  base.roles = [
    { role: "super-admin", description: "Full system access across all schools and branches.", scope: "all-schools", isSystem: true, status: "active" },
    { role: "school-owner", description: "Oversight and read access across the organisation.", scope: "all-schools", isSystem: true, status: "active" },
    { role: "principal", description: "Academic leadership and approvals for a branch.", scope: "own-branch", isSystem: true, status: "active" },
    { role: "administrator", description: "Day-to-day operations for a branch.", scope: "own-branch", isSystem: true, status: "active" },
    { role: "teacher", description: "Teaching, attendance and marks for assigned classes.", scope: "assigned-classes", isSystem: true, status: "active" },
    { role: "hr-manager", description: "People operations, letters and staff records.", scope: "own-branch", isSystem: true, status: "active" },
    { role: "accountant", description: "Fees, accounting and finance operations.", scope: "own-branch", isSystem: true, status: "active" },
    { role: "librarian", description: "Library catalogue, circulation and cards.", scope: "own-branch", isSystem: true, status: "active" },
    { role: "transport-manager", description: "Routes, vehicles and transport operations.", scope: "own-branch", isSystem: true, status: "active" },
    { role: "parent", description: "View own children's records.", scope: "own-records", isSystem: true, status: "active" },
    { role: "student", description: "View own academic records.", scope: "own-records", isSystem: true, status: "active" },
    { role: "examination-controller", description: "Exam scheduling, marks and results.", scope: "own-branch", isSystem: false, status: "active" },
  ];

  base.workflows = [
    { id: "wf-leave", name: "Leave Request", module: "HR", description: "Staff leave approval chain.", status: "active", steps: [{ id: "s1", order: 0, role: "teacher", label: "Employee submits", required: true }, { id: "s2", order: 1, role: "department-head", label: "Manager review", required: true }, { id: "s3", order: 2, role: "hr-manager", label: "HR approval", required: true, escalation: "Principal after 3 days" }] },
    { id: "wf-concession", name: "Fee Concession", module: "Fees", description: "Discount/concession sign-off.", status: "active", steps: [{ id: "s1", order: 0, role: "accountant", label: "Accountant raises", required: true }, { id: "s2", order: 1, role: "principal", label: "Principal approves", required: true }] },
    { id: "wf-purchase", name: "Purchase Order", module: "Inventory", description: "Procurement approval.", status: "active", steps: [{ id: "s1", order: 0, role: "department-head", label: "Department Head", required: true }, { id: "s2", order: 1, role: "accountant", label: "Finance review", required: true }, { id: "s3", order: 2, role: "principal", label: "Principal approves", required: true }] },
    { id: "wf-result", name: "Result Publication", module: "Exams", description: "Result sign-off before publishing.", status: "active", steps: [{ id: "s1", order: 0, role: "teacher", label: "Teacher submits marks", required: true }, { id: "s2", order: 1, role: "examination-controller", label: "Exam Controller verifies", required: true }, { id: "s3", order: 2, role: "principal", label: "Principal publishes", required: true }] },
  ];

  base.customFields = [
    { id: "cf-1", label: "Aadhaar (last 4)", key: "aadhaar_last4", module: "Student", type: "text", required: false, options: [], helpText: "Last 4 digits only — never store full ID.", visibility: "admin", order: 0, status: "active" },
    { id: "cf-2", label: "Transport Zone", key: "transport_zone", module: "Transport", type: "dropdown", required: true, options: ["Zone A", "Zone B", "Zone C"], helpText: "Used for route planning.", visibility: "staff", order: 1, status: "active" },
    { id: "cf-3", label: "Sibling in school", key: "has_sibling", module: "Admission", type: "checkbox", required: false, options: [], helpText: "", visibility: "everyone", order: 2, status: "active" },
    { id: "cf-4", label: "Emergency doctor", key: "emergency_doctor", module: "Health", type: "phone", required: false, options: [], helpText: "Alternate to guardian.", visibility: "staff", order: 3, status: "inactive" },
    { id: "cf-5", label: "Prior school", key: "prior_school", module: "Admission", type: "text", required: false, options: [], helpText: "", visibility: "staff", order: 4, status: "active" },
  ];

  base.customStatuses = [
    { id: "cs-1", name: "Provisional", color: "#f59e0b", order: 0, module: "Admission", terminal: false, active: true, isProtected: false },
    { id: "cs-2", name: "Waitlisted", color: "#0ea5e9", order: 1, module: "Admission", terminal: false, active: true, isProtected: false },
    { id: "cs-3", name: "Active", color: "#16a34a", order: 0, module: "Student", terminal: false, active: true, isProtected: true },
    { id: "cs-4", name: "Archived", color: "#64748b", order: 5, module: "Student", terminal: true, active: true, isProtected: true },
    { id: "cs-5", name: "On Hold", color: "#a855f7", order: 2, module: "Fees", terminal: false, active: true, isProtected: false },
  ];

  base.numbering = [
    { id: "nr-adm", name: "Student Admission Number", entity: "Student", prefix: "STU", includeBranch: false, includeYear: true, includeSession: false, separator: "/", sequenceLength: 4, nextSequence: 42 },
    { id: "nr-emp", name: "Employee ID", entity: "Staff", prefix: "EMP", includeBranch: true, includeYear: false, includeSession: false, separator: "-", sequenceLength: 3, nextSequence: 61 },
    { id: "nr-inv", name: "Invoice", entity: "Fees", prefix: "INV", includeBranch: false, includeYear: true, includeSession: false, separator: "/", sequenceLength: 5, nextSequence: 1204 },
    { id: "nr-rcpt", name: "Receipt", entity: "Fees", prefix: "RCPT", includeBranch: false, includeYear: true, includeSession: false, separator: "/", sequenceLength: 5, nextSequence: 3391 },
    { id: "nr-cert", name: "Certificate", entity: "Documents", prefix: "BON", includeBranch: false, includeYear: true, includeSession: false, separator: "/", sequenceLength: 4, nextSequence: 121 },
    { id: "nr-tc", name: "Transfer Certificate", entity: "Documents", prefix: "TC", includeBranch: false, includeYear: true, includeSession: false, separator: "/", sequenceLength: 4, nextSequence: 42 },
    { id: "nr-lib", name: "Library Accession", entity: "Library", prefix: "ACC", includeBranch: false, includeYear: true, includeSession: false, separator: "-", sequenceLength: 5, nextSequence: 8842 },
    { id: "nr-asset", name: "Asset ID", entity: "Assets", prefix: "AST", includeBranch: true, includeYear: false, includeSession: false, separator: "-", sequenceLength: 4, nextSequence: 512 },
    { id: "nr-visitor", name: "Visitor Pass", entity: "Front Desk", prefix: "VP", includeBranch: false, includeYear: false, includeSession: false, separator: "-", sequenceLength: 4, nextSequence: 97 },
    { id: "nr-ticket", name: "Helpdesk Ticket", entity: "Helpdesk", prefix: "TKT", includeBranch: false, includeYear: true, includeSession: false, separator: "-", sequenceLength: 4, nextSequence: 233 },
    { id: "nr-po", name: "Purchase Order", entity: "Inventory", prefix: "PO", includeBranch: true, includeYear: true, includeSession: false, separator: "/", sequenceLength: 4, nextSequence: 88 },
  ];

  base.notifications = NOTIFY_MODULES.map((m) => {
    const channels: Record<NotificationChannel, boolean> = { "in-app": true, push: m !== "System", email: ["Fees", "Exams", "HR", "System"].includes(m), sms: ["Attendance", "Fees", "Transport"].includes(m), whatsapp: ["Attendance", "Fees"].includes(m) };
    return { module: m, channels };
  });

  base.integrations = [
    { id: "int-razorpay", name: "Razorpay", category: "payments", description: "UPI, cards and netbanking for fee collection.", capabilities: ["Fee payments", "Refunds", "Payment links"], requiredSetup: ["API key", "Webhook URL"], status: "not-connected", logoGlyph: "R" },
    { id: "int-stripe", name: "Stripe", category: "payments", description: "International card payments.", capabilities: ["Card payments", "Subscriptions"], requiredSetup: ["Publishable key", "Secret key"], status: "not-connected", logoGlyph: "S" },
    { id: "int-cashfree", name: "Cashfree", category: "payments", description: "Payments and payouts.", capabilities: ["Payments", "Payouts"], requiredSetup: ["App ID", "Secret"], status: "not-connected", logoGlyph: "C" },
    { id: "int-whatsapp", name: "WhatsApp Business", category: "communication", description: "Template messaging to parents.", capabilities: ["Templates", "Alerts"], requiredSetup: ["Phone ID", "Access token"], status: "demo-placeholder", logoGlyph: "W" },
    { id: "int-sms", name: "SMS Provider", category: "communication", description: "Transactional SMS gateway.", capabilities: ["SMS", "OTP"], requiredSetup: ["Sender ID", "API key"], status: "demo-placeholder", logoGlyph: "M" },
    { id: "int-email", name: "Email Provider", category: "communication", description: "Transactional email delivery.", capabilities: ["Email", "Templates"], requiredSetup: ["SMTP / API"], status: "demo-placeholder", logoGlyph: "@" },
    { id: "int-gps", name: "GPS Provider", category: "gps", description: "Live vehicle tracking feed.", capabilities: ["Live location", "Geofence"], requiredSetup: ["Device API"], status: "not-connected", logoGlyph: "G" },
    { id: "int-s3", name: "S3-compatible Storage", category: "storage", description: "Document & media storage.", capabilities: ["Uploads", "Signed URLs"], requiredSetup: ["Bucket", "Access keys"], status: "not-connected", logoGlyph: "☁" },
    { id: "int-ai", name: "AI Provider", category: "ai", description: "Assistive drafting and summaries.", capabilities: ["Summaries", "Drafting"], requiredSetup: ["API key"], status: "not-connected", logoGlyph: "✦" },
    { id: "int-analytics", name: "Analytics", category: "analytics", description: "Usage analytics.", capabilities: ["Events", "Dashboards"], requiredSetup: ["Project token"], status: "not-connected", logoGlyph: "▲" },
  ];

  base.modules = MODULE_LIST.map((m, i): ModuleSetting => ({ id: m.id, label: m.label, enabled: true, order: i, roleVisibility: "everyone", branchAvailable: true }));
  // A couple disabled on some branches to show state.
  base.modules = base.modules.map((m) => (m.id === "cafeteria" ? { ...m, branchAvailable: false } : m.id === "hostel" ? { ...m, roleVisibility: "staff" as const } : m));

  base.features = [
    { id: "ft-qr-attendance", label: "Student QR attendance", description: "Mark attendance by scanning student QR.", state: "beta" },
    { id: "ft-period-attendance", label: "Period attendance", description: "Per-period attendance capture.", state: "enabled" },
    { id: "ft-parent-ack", label: "Parent acknowledgements", description: "Require parent acknowledgement on notices.", state: "enabled" },
    { id: "ft-transport-live", label: "Transport live view", description: "Live map for buses (needs GPS integration).", state: "coming-soon" },
    { id: "ft-hostel", label: "Hostel module", description: "Hostel allocation and mess.", state: "enabled" },
    { id: "ft-cafeteria", label: "Cafeteria ordering", description: "Pre-order meals from the canteen.", state: "beta" },
    { id: "ft-digital-library", label: "Digital library", description: "E-books and digital resources.", state: "enabled" },
    { id: "ft-advanced-reports", label: "Advanced reports", description: "Cross-module analytics builder.", state: "coming-soon" },
  ];

  base.security = [
    { key: "password-policy", label: "Password policy", description: "Min 8 chars, 1 number, 1 symbol.", value: "Strong", backendRequired: true, enabled: true },
    { key: "session-timeout", label: "Session timeout", description: "Auto sign-out after inactivity.", value: "30 minutes", backendRequired: true, enabled: true },
    { key: "2fa", label: "Two-factor authentication", description: "Second factor at sign-in.", value: "Optional", backendRequired: true, enabled: false },
    { key: "login-attempts", label: "Login attempt policy", description: "Lock after failed attempts.", value: "5 attempts", backendRequired: true, enabled: true },
    { key: "trusted-devices", label: "Trusted devices", description: "Remember known devices.", value: "Off", backendRequired: true, enabled: false },
    { key: "ip-restriction", label: "IP restriction", description: "Restrict admin access by IP.", value: "Off", backendRequired: true, enabled: false },
    { key: "export-restriction", label: "Data export restrictions", description: "Limit who can export data.", value: "Admins only", backendRequired: false, enabled: true },
  ];

  const modulesForAudit = ["Students", "Fees", "Exams", "HR", "Documents", "Settings", "Transport", "Attendance"];
  const actions = ["Created", "Updated", "Deleted", "Approved", "Exported", "Viewed", "Role changed", "Login"];
  base.auditLog = Array.from({ length: 40 }, (_, i) => {
    const actor = helpers.pick(base.users);
    const status = helpers.rand() < 0.85 ? "success" : helpers.rand() < 0.6 ? "denied" : "warning";
    const action = helpers.pick(actions);
    return { id: `al-${i}`, timestamp: isoTime(helpers.int(0, 400)), actor: actor.name, role: actor.role, module: helpers.pick(modulesForAudit), action, record: `#${helpers.int(1000, 9999)}`, branch: actor.branch, status: status as "success" | "denied" | "warning", previousValue: action === "Updated" || action === "Role changed" ? helpers.pick(["Draft", "Active", "Teacher", "Pending"]) : undefined, newValue: action === "Updated" || action === "Role changed" ? helpers.pick(["Published", "Inactive", "Class Teacher", "Approved"]) : undefined, reason: status === "denied" ? "Insufficient permissions" : undefined };
  });

  base.imports = [
    { id: "im-1", module: "Students", fileName: "class5-intake.csv", rows: 42, valid: 39, errors: 3, status: "validated", createdAt: isoTime(4) },
    { id: "im-2", module: "Marks", fileName: "term1-marks.xlsx", rows: 320, valid: 320, errors: 0, status: "completed", createdAt: isoTime(30) },
    { id: "im-3", module: "Library", fileName: "new-titles.csv", rows: 88, valid: 84, errors: 4, status: "mapping", createdAt: isoTime(1) },
  ];
  base.exports = [
    { id: "ex-1", module: "Students", format: "xlsx", rows: activeStudents, status: "completed", createdAt: isoTime(6) },
    { id: "ex-2", module: "Fees", format: "csv", rows: 1204, status: "ready", createdAt: isoTime(2) },
    { id: "ex-3", module: "Attendance", format: "pdf", rows: 5600, status: "generating", createdAt: isoTime(0) },
  ];
  base.backups = [
    { id: "bk-1", label: "Nightly backup", sizeMb: 148, createdAt: isoTime(9), type: "scheduled", status: "available" },
    { id: "bk-2", label: "Pre-migration snapshot", sizeMb: 152, createdAt: isoTime(72), type: "manual", status: "available" },
    { id: "bk-3", label: "Nightly backup", sizeMb: 145, createdAt: isoTime(33), type: "scheduled", status: "available" },
  ];
  base.systemHealth = [
    { id: "sh-web", label: "Web application", category: "Core", state: "demo", note: "Running in demo mode." },
    { id: "sh-db", label: "Database", category: "Core", state: "not-configured", note: "No database connected — frontend mock state only." },
    { id: "sh-storage", label: "Storage", category: "Infrastructure", state: "ready-for-integration", note: "Connect S3-compatible storage." },
    { id: "sh-comm", label: "Communication", category: "Messaging", state: "ready-for-integration", note: "Only in-app is live; SMS/Email/WhatsApp need providers." },
    { id: "sh-pay", label: "Payments", category: "Finance", state: "not-configured", note: "Connect a payment gateway to accept online fees." },
    { id: "sh-gps", label: "GPS tracking", category: "Transport", state: "not-configured", note: "Connect a GPS provider for live tracking." },
  ];
  base.policies = [
    { id: "pol-att", name: "Attendance Policy", version: "v2.1", effectiveDate: "2026-04-01", audience: "All", acknowledged: 94, status: "published" },
    { id: "pol-fee", name: "Fee Policy", version: "v1.4", effectiveDate: "2026-04-01", audience: "Parents", acknowledged: 88, status: "published" },
    { id: "pol-leave", name: "Leave Policy", version: "v3.0", effectiveDate: "2026-04-01", audience: "Staff", acknowledged: 97, status: "published" },
    { id: "pol-transport", name: "Transport Policy", version: "v1.1", effectiveDate: "2026-04-01", audience: "Parents", acknowledged: 72, status: "published" },
    { id: "pol-device", name: "Device & BYOD Policy", version: "v1.0", effectiveDate: "2026-07-01", audience: "Students", acknowledged: 0, status: "draft" },
    { id: "pol-comm", name: "Communication Policy", version: "v1.2", effectiveDate: "2026-04-01", audience: "All", acknowledged: 91, status: "published" },
  ];
  base.legal = [
    { id: "lg-privacy", title: "Privacy Notice", kind: "privacy", version: "v2.0", updatedAt: daysAgo(30), status: "published", body: "Novyra Public School collects and processes student and guardian data solely for legitimate educational administration. We never sell personal data. Sensitive records (health, counselling) are access-restricted." },
    { id: "lg-terms", title: "Terms of Use", kind: "terms", version: "v1.3", updatedAt: daysAgo(60), status: "published", body: "By using Novyra Campus OS you agree to use the platform for authorised school administration only." },
    { id: "lg-consent", title: "Parent Consent", kind: "parent-consent", version: "v1.1", updatedAt: daysAgo(45), status: "published", body: "I consent to the school communicating with me via the platform and to my child's participation in listed activities." },
    { id: "lg-aup", title: "Student Acceptable-Use Policy", kind: "student-aup", version: "v1.0", updatedAt: daysAgo(20), status: "draft", body: "Students agree to use school digital resources responsibly and respectfully." },
    { id: "lg-staff-it", title: "Staff IT Policy", kind: "staff-it", version: "v2.2", updatedAt: daysAgo(90), status: "published", body: "Staff must protect credentials, respect data privacy and report security incidents promptly." },
  ];

  return base;
}

type SystemAccessLevel = "full" | "branch" | "scoped" | "read-only";
type AdminUserStatus = "active" | "invited" | "suspended" | "locked" | "inactive";
