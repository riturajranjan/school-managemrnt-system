// RBAC catalog (Backend Phase 3) — the foundational permission set and the
// system-role → permission mapping. Pure constants (no DB), shared by the seed,
// the authorization layer, and tests. Intentionally a compact, meaningful
// foundation — not every module×action combination.

export type PermissionDef = { key: string; module: string; action: string; description: string };

export const PERMISSIONS: PermissionDef[] = [
  { key: "dashboard.view", module: "dashboard", action: "view", description: "View the dashboard" },

  { key: "students.view", module: "students", action: "view", description: "View students" },
  { key: "students.create", module: "students", action: "create", description: "Add students" },
  { key: "students.update", module: "students", action: "update", description: "Edit students" },
  { key: "students.archive", module: "students", action: "archive", description: "Archive students" },
  { key: "students.export", module: "students", action: "export", description: "Export students" },

  { key: "admissions.view", module: "admissions", action: "view", description: "View admissions" },
  { key: "admissions.create", module: "admissions", action: "create", description: "Create admissions" },
  { key: "admissions.update", module: "admissions", action: "update", description: "Edit admissions" },
  { key: "admissions.approve", module: "admissions", action: "approve", description: "Approve admissions" },

  { key: "guardians.view", module: "guardians", action: "view", description: "View guardians" },
  { key: "guardians.create", module: "guardians", action: "create", description: "Add guardians" },
  { key: "guardians.update", module: "guardians", action: "update", description: "Edit guardians and links" },

  { key: "academics.view", module: "academics", action: "view", description: "View academics" },
  { key: "academics.manage", module: "academics", action: "manage", description: "Manage academics" },

  { key: "attendance.view", module: "attendance", action: "view", description: "View attendance" },
  { key: "attendance.mark", module: "attendance", action: "mark", description: "Mark attendance" },

  { key: "timetable.view", module: "timetable", action: "view", description: "View timetable" },
  { key: "timetable.manage", module: "timetable", action: "manage", description: "Manage timetable" },

  { key: "exams.view", module: "exams", action: "view", description: "View exams" },
  { key: "exams.manage", module: "exams", action: "manage", description: "Manage exams" },

  { key: "results.view", module: "results", action: "view", description: "View results" },
  { key: "results.publish", module: "results", action: "publish", description: "Publish results" },

  { key: "fees.view", module: "fees", action: "view", description: "View fees" },
  { key: "fees.collect", module: "fees", action: "collect", description: "Collect fees" },
  { key: "fees.refund", module: "fees", action: "refund", description: "Refund fees" },

  { key: "transport.view", module: "transport", action: "view", description: "View transport" },
  { key: "transport.manage", module: "transport", action: "manage", description: "Manage transport" },

  { key: "library.view", module: "library", action: "view", description: "View library" },
  { key: "library.manage", module: "library", action: "manage", description: "Manage library" },

  { key: "hr.view", module: "hr", action: "view", description: "View HR" },
  { key: "hr.manage", module: "hr", action: "manage", description: "Manage HR" },

  { key: "communication.view", module: "communication", action: "view", description: "View communication" },
  { key: "communication.send", module: "communication", action: "send", description: "Send communication" },

  { key: "documents.view", module: "documents", action: "view", description: "View documents" },
  { key: "documents.manage", module: "documents", action: "manage", description: "Manage documents" },

  { key: "settings.view", module: "settings", action: "view", description: "View settings" },
  { key: "settings.manage", module: "settings", action: "manage", description: "Manage settings" },

  // Platform-only. Intentionally NOT granted to any tenant/school role.
  // The umbrella gate for the SaaS control center.
  { key: "super_admin.access", module: "super_admin", action: "access", description: "Access the platform control center" },

  // ---------------------------------------------------------------------------
  // Platform (SaaS control center) permission namespace (Super Admin Phase SA-1).
  // Prefixed `platform.*` so it can never be confused with a tenant/school
  // permission. These are granted ONLY to platform admins, by their PlatformRole
  // (see PLATFORM_ROLE_PERMISSIONS) — never via a tenant RoleAssignment.
  // ---------------------------------------------------------------------------
  { key: "platform.dashboard.view", module: "platform.dashboard", action: "view", description: "View the platform dashboard" },
  { key: "platform.schools.view", module: "platform.schools", action: "view", description: "View customer schools" },
  { key: "platform.schools.create", module: "platform.schools", action: "create", description: "Provision new schools" },
  { key: "platform.schools.update", module: "platform.schools", action: "update", description: "Edit school records" },
  { key: "platform.schools.suspend", module: "platform.schools", action: "suspend", description: "Suspend/reactivate schools" },
  { key: "platform.onboarding.view", module: "platform.onboarding", action: "view", description: "View onboarding" },
  { key: "platform.onboarding.manage", module: "platform.onboarding", action: "manage", description: "Manage onboarding" },
  { key: "platform.plans.view", module: "platform.plans", action: "view", description: "View plans" },
  { key: "platform.plans.manage", module: "platform.plans", action: "manage", description: "Manage plans" },
  { key: "platform.subscriptions.view", module: "platform.subscriptions", action: "view", description: "View subscriptions" },
  { key: "platform.subscriptions.manage", module: "platform.subscriptions", action: "manage", description: "Manage subscriptions" },
  { key: "platform.trials.view", module: "platform.trials", action: "view", description: "View trials" },
  { key: "platform.trials.manage", module: "platform.trials", action: "manage", description: "Manage trials" },
  { key: "platform.usage.view", module: "platform.usage", action: "view", description: "View usage & limits" },
  { key: "platform.billing.view", module: "platform.billing", action: "view", description: "View billing" },
  { key: "platform.billing.manage", module: "platform.billing", action: "manage", description: "Manage billing" },
  { key: "platform.invoices.view", module: "platform.invoices", action: "view", description: "View invoices" },
  { key: "platform.invoices.manage", module: "platform.invoices", action: "manage", description: "Manage invoices" },
  { key: "platform.payments.view", module: "platform.payments", action: "view", description: "View payments" },
  { key: "platform.payments.manage", module: "platform.payments", action: "manage", description: "Record & reverse payments" },
  { key: "platform.features.view", module: "platform.features", action: "view", description: "View features" },
  { key: "platform.features.manage", module: "platform.features", action: "manage", description: "Manage features" },
  { key: "platform.addons.view", module: "platform.addons", action: "view", description: "View add-ons" },
  { key: "platform.addons.manage", module: "platform.addons", action: "manage", description: "Manage add-ons" },
  { key: "platform.marketplace.view", module: "platform.marketplace", action: "view", description: "View marketplace" },
  { key: "platform.marketplace.manage", module: "platform.marketplace", action: "manage", description: "Manage marketplace" },
  { key: "platform.domains.view", module: "platform.domains", action: "view", description: "View domains" },
  { key: "platform.domains.manage", module: "platform.domains", action: "manage", description: "Manage domains" },
  { key: "platform.branding.view", module: "platform.branding", action: "view", description: "View platform branding" },
  { key: "platform.branding.manage", module: "platform.branding", action: "manage", description: "Manage platform branding" },
  { key: "platform.support.view", module: "platform.support", action: "view", description: "View support tickets" },
  { key: "platform.support.manage", module: "platform.support", action: "manage", description: "Manage support tickets" },
  { key: "platform.tenant_health.view", module: "platform.tenant_health", action: "view", description: "View tenant health" },
  { key: "platform.settings.view", module: "platform.settings", action: "view", description: "View platform settings" },
  { key: "platform.settings.manage", module: "platform.settings", action: "manage", description: "Manage platform settings" },
  { key: "platform.audit.view", module: "platform.audit", action: "view", description: "View the platform audit log" },
  // High-trust: start/stop server-authoritative read-only impersonation of a
  // school. Deliberately `.manage` (never `.view`) so the read-only AUDITOR role
  // — which receives all `platform.*.view` keys — does NOT get it. Only
  // SUPER_ADMIN receives it (via the full PLATFORM_ONLY_KEYS spread below); it is
  // absent from the explicit SUPPORT/BILLING allowlists.
  { key: "platform.impersonation.manage", module: "platform.impersonation", action: "manage", description: "Impersonate (read-only inspect) a school" },
];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

/** All platform-scope keys (the umbrella gate + the `platform.*` namespace). */
export const PLATFORM_PERMISSION_KEYS = PERMISSION_KEYS.filter(
  (k) => k === "super_admin.access" || k.startsWith("platform."),
);

/**
 * Read-only tenant INSPECTION permission set (Super Admin Phase SA-4K). The
 * exact permissions a platform admin receives for the TARGET school while
 * impersonating — every tenant/school permission whose action is `view` (the
 * codebase convention for a pure read). Derived from the catalog so it can never
 * drift: adding a new `*.view` permission automatically becomes inspectable, and
 * NO write action (`create`/`update`/`archive`/`approve`/`manage`/`mark`/… or
 * `export`) can ever leak in. Platform (`platform.*`) keys are excluded — those
 * come from the actor's own platform role, not from the target tenant.
 */
export const INSPECTION_PERMISSION_KEYS: string[] = PERMISSIONS.filter(
  (p) => p.action === "view" && p.key !== "super_admin.access" && !p.key.startsWith("platform."),
).map((p) => p.key);

// System-role key → permission keys. No wildcard admin; super_admin.access is
// never granted here (platform access is a separate boundary via PlatformAdmin).
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  SCHOOL_ADMIN: [
    "dashboard.view",
    "students.view", "students.create", "students.update", "students.archive", "students.export",
    "admissions.view", "admissions.create", "admissions.update", "admissions.approve",
    "guardians.view", "guardians.create", "guardians.update",
    "academics.view", "academics.manage",
    "attendance.view", "attendance.mark",
    "timetable.view", "timetable.manage",
    "exams.view", "exams.manage",
    "results.view", "results.publish",
    "fees.view", "fees.collect", "fees.refund",
    "transport.view",
    "library.view",
    "hr.view",
    "communication.view", "communication.send",
    "documents.view", "documents.manage",
    "settings.view", "settings.manage",
  ],
  PRINCIPAL: [
    "dashboard.view",
    "students.view",
    "admissions.view", "admissions.approve",
    "guardians.view",
    "academics.view", "academics.manage",
    "attendance.view",
    "timetable.view", "timetable.manage",
    "exams.view", "exams.manage",
    "results.view", "results.publish",
    "fees.view",
    "communication.view", "communication.send",
    "documents.view",
    "settings.view",
  ],
  TEACHER: [
    "dashboard.view",
    "students.view",
    "guardians.view",
    "academics.view",
    "attendance.view", "attendance.mark",
    "timetable.view",
    "exams.view",
    "results.view",
    "communication.send",
    "documents.view",
  ],
  LIBRARIAN: ["dashboard.view", "students.view", "library.view", "library.manage"],
  TRANSPORT_MANAGER: ["dashboard.view", "transport.view", "transport.manage"],
  HR_ADMIN: ["dashboard.view", "hr.view", "hr.manage"],
};

// ---------------------------------------------------------------------------
// PlatformRole → platform permission keys (Super Admin Phase SA-1).
//
// This is a SEPARATE authorization domain from ROLE_PERMISSIONS above. It maps
// the PlatformAdmin.role enum (SUPER_ADMIN | SUPPORT | BILLING | AUDITOR) to
// `platform.*` permissions, resolved in code for platform admins only. Every
// platform role also implicitly receives `super_admin.access` (the gate) in the
// resolver. A platform role NEVER grants tenant permissions, and a tenant role
// NEVER appears here.
// ---------------------------------------------------------------------------
const PLATFORM_ONLY_KEYS = PLATFORM_PERMISSION_KEYS.filter((k) => k !== "super_admin.access");

export const PLATFORM_ROLE_PERMISSIONS: Record<string, string[]> = {
  // Full platform authority.
  SUPER_ADMIN: [...PLATFORM_ONLY_KEYS],
  // Customer-success / support: schools + onboarding + support + health + read
  // billing context; no plan/feature/domain/branding management.
  SUPPORT: [
    "platform.dashboard.view",
    "platform.schools.view",
    "platform.onboarding.view", "platform.onboarding.manage",
    "platform.subscriptions.view",
    "platform.trials.view",
    "platform.usage.view",
    "platform.invoices.view",
    "platform.payments.view",
    "platform.support.view", "platform.support.manage",
    "platform.tenant_health.view",
    "platform.audit.view",
  ],
  // Billing operations: revenue surfaces (plans/subscriptions/billing/invoices).
  BILLING: [
    "platform.dashboard.view",
    "platform.schools.view",
    "platform.plans.view", "platform.plans.manage",
    "platform.subscriptions.view", "platform.subscriptions.manage",
    "platform.trials.view", "platform.trials.manage",
    "platform.usage.view",
    "platform.billing.view", "platform.billing.manage",
    "platform.invoices.view", "platform.invoices.manage",
    "platform.payments.view", "platform.payments.manage",
    "platform.tenant_health.view",
  ],
  // Read-only compliance role: view everything, manage nothing.
  AUDITOR: PLATFORM_ONLY_KEYS.filter((k) => k.endsWith(".view")),
};

/** Platform permission keys for a PlatformRole (incl. the umbrella gate). */
export function platformPermissionsForRole(role: string | null | undefined): string[] {
  const granted = (role && PLATFORM_ROLE_PERMISSIONS[role]) || [];
  return ["super_admin.access", ...granted];
}

// Bridge: DB system-role key → the existing UI `UserRole` value, so the client
// PermissionsProvider can render for the user's REAL active role (not a mock
// default). Platform admins map to the UI "super-admin" role.
export const DB_ROLE_TO_UI: Record<string, string> = {
  SCHOOL_ADMIN: "administrator",
  PRINCIPAL: "principal",
  TEACHER: "teacher",
  LIBRARIAN: "librarian",
  TRANSPORT_MANAGER: "transport-manager",
  HR_ADMIN: "hr-manager",
};
export const PLATFORM_UI_ROLE = "super-admin";

