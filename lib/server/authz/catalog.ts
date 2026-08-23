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

  // Phase 8B — deliberately separate from exams.manage: entering/verifying marks
  // is a distinct, narrower trust boundary than managing the exam schedule itself
  // (a TEACHER can enter marks for their own assigned section+subject without
  // being able to reschedule papers or edit exam terms).
  { key: "marks.enter", module: "marks", action: "enter", description: "Enter exam marks" },
  { key: "marks.verify", module: "marks", action: "verify", description: "Verify exam marks" },

  { key: "results.view", module: "results", action: "view", description: "View results" },
  { key: "results.publish", module: "results", action: "publish", description: "Publish results" },

  // Phase 8E — Promotion is a separate, explicit administrative decision from
  // an exam result, so it gets its own permission pair rather than reusing
  // results.*: a TEACHER may see who's eligible without being able to
  // actually move a student into next year's Enrollment.
  { key: "promotion.view", module: "promotion", action: "view", description: "View promotion candidates & history" },
  { key: "promotion.manage", module: "promotion", action: "manage", description: "Process student promotion/retention decisions" },

  // Phase 9B — Homework. Distinct from academics.* (which owns Class/Section/
  // Subject/TeachingAssignment CRUD): homework.manage covers create/edit/
  // publish/close, granted broadly to TEACHER too (like marks.enter) — actual
  // authorship is still constrained server-side to the actor's own real
  // TeachingAssignment.
  { key: "homework.view", module: "homework", action: "view", description: "View homework" },
  { key: "homework.manage", module: "homework", action: "manage", description: "Create, edit, publish and close homework" },

  // Phase 9C.1 — Curriculum/Syllabus. Its own domain (like homework.*) rather
  // than folded into academics.* (Class/Section/Subject CRUD): curriculum
  // content authoring (units/chapters/topics) is a broad-manager action, but
  // per-section topic PROGRESS is granted to TEACHER too and constrained
  // server-side to the actor's own real TeachingAssignment.
  { key: "curriculum.view", module: "curriculum", action: "view", description: "View curriculum, syllabus and section progress" },
  { key: "curriculum.manage", module: "curriculum", action: "manage", description: "Author curriculum content and update section topic progress" },

  // Phase 9C.2 — Lesson Plans. lessonPlans.manage covers create/edit/submit/
  // complete for the actor's own real TeachingAssignment; approve/reject is a
  // broad-manager action gated the same way homework's publish/close is.
  { key: "lessonPlans.view", module: "lessonPlans", action: "view", description: "View lesson plans" },
  { key: "lessonPlans.manage", module: "lessonPlans", action: "manage", description: "Create, edit, submit, review and complete lesson plans" },

  // Phase 9D.1 — Academic Calendar. calendar.view is granted broadly (every
  // school role that has dashboard.view); calendar.manage (author/cancel
  // manual events) is a broad-manager-only action, matching the existing
  // client-side UI matrix (super-admin/school-owner/principal/academic-
  // coordinator/administrator already gate "Add event" on it).
  { key: "calendar.view", module: "calendar", action: "view", description: "View the academic calendar" },
  { key: "calendar.manage", module: "calendar", action: "manage", description: "Create, edit and cancel calendar events" },

  // Phase 9E.1 — Staff Attendance. Its own domain (not folded into attendance.*,
  // which is student attendance): staffAttendance.view gates the confidential
  // staff roster (broad managers only — a TEACHER sees their own day via My Day,
  // not the roster), matching the existing client permission matrix.
  { key: "staffAttendance.view", module: "staffAttendance", action: "view", description: "View the staff attendance roster" },
  { key: "staffAttendance.manage", module: "staffAttendance", action: "manage", description: "Mark and correct staff attendance" },

  // Phase 9E.2 — Leave Management. leave.submit is self-service (submit/view/
  // cancel own requests) — broadly granted, matching the existing client matrix.
  // leave.approve is the broad-manager review action (view all, approve/reject).
  { key: "leave.submit", module: "leave", action: "submit", description: "Submit and manage own leave requests" },
  { key: "leave.approve", module: "leave", action: "approve", description: "Review, approve and reject staff leave requests" },

  { key: "fees.view", module: "fees", action: "view", description: "View fees, dues and reports" },
  // Phase 9F — categories/structures/assignment/discounts/scholarships/late
  // fees/reconciliation are all broad-manager actions under one key, matching
  // the catalog's existing compact-foundation philosophy (like curriculum.manage
  // covering several sub-actions) rather than a dozen granular fee permissions.
  { key: "fees.manage", module: "fees", action: "manage", description: "Manage fee categories, structures, assignments, discounts, scholarships, late fees and reconciliation" },
  { key: "fees.collect", module: "fees", action: "collect", description: "Collect fees" },
  { key: "fees.refund", module: "fees", action: "refund", description: "Refund fees" },

  // Phase 9G — Accounting/General Ledger. No real ACCOUNTANT/BILLING DB role
  // exists yet, so these are granted to SCHOOL_ADMIN (full) / PRINCIPAL
  // (view, matching its existing fees.view-only oversight pattern) — never a
  // new role invented just for this phase.
  { key: "accounting.view", module: "accounting", action: "view", description: "View chart of accounts, journals, ledger and reports" },
  { key: "accounting.manage", module: "accounting", action: "manage", description: "Manage chart of accounts and create manual journals" },
  { key: "accounting.post", module: "accounting", action: "post", description: "Post a draft journal entry" },
  { key: "accounting.reverse", module: "accounting", action: "reverse", description: "Reverse a posted journal entry" },

  // Phase 9H — Payroll. Same reasoning as Fees/Accounting: no real
  // ACCOUNTANT/HR_MANAGER DB role exists, so these are granted to
  // SCHOOL_ADMIN (full) / PRINCIPAL (view, matching its accounting.view-only
  // oversight pattern) — never a new role invented for this phase. Staff
  // self-service payslip access is identity-based (Staff.userId), not
  // gated by any of these permissions.
  { key: "payroll.view", module: "payroll", action: "view", description: "View salary structures, payroll runs, payslips, reports and dashboard" },
  { key: "payroll.manage", module: "payroll", action: "manage", description: "Manage salary components/structures, staff assignments and payroll runs" },
  { key: "payroll.finalize", module: "payroll", action: "finalize", description: "Finalize a calculated payroll run" },
  { key: "payroll.pay", module: "payroll", action: "pay", description: "Record payment for a finalized payroll run" },

  // Phase 9I — Visitor Management. No real "receptionist" DB role exists
  // (mock-only), so these are granted to SCHOOL_ADMIN (full) / PRINCIPAL
  // (view, matching the established oversight pattern) — never a new role
  // invented for this phase. checkIn/checkOut are folded into
  // visitors.manage (the mock UI only ever distinguished view/manage too).
  { key: "visitors.view", module: "visitors", action: "view", description: "View visitors, visits, expected visitors and dashboard" },
  { key: "visitors.manage", module: "visitors", action: "manage", description: "Register visitors, check in/out, cancel visits" },

  { key: "transport.view", module: "transport", action: "view", description: "View transport" },
  { key: "transport.manage", module: "transport", action: "manage", description: "Manage transport" },

  { key: "library.view", module: "library", action: "view", description: "View library" },
  { key: "library.manage", module: "library", action: "manage", description: "Manage library" },

  // Phase 9O — Inventory (consumables) and Assets (durable, individually
  // tracked). No real "storekeeper"/"asset manager" DB role exists, so —
  // matching the Visitor Management precedent — these are granted to
  // SCHOOL_ADMIN (full) / PRINCIPAL (view, oversight) rather than inventing
  // a new role.
  { key: "inventory.view", module: "inventory", action: "view", description: "View inventory items, stock and movements" },
  { key: "inventory.manage", module: "inventory", action: "manage", description: "Manage inventory items/locations and post receipts, issues, transfers, adjustments" },

  { key: "assets.view", module: "assets", action: "view", description: "View the asset register, assignments and maintenance" },
  { key: "assets.manage", module: "assets", action: "manage", description: "Manage assets, assignments, status and maintenance" },

  // Phase 9Q — Hostel Management. No real "warden"/"hostel manager" DB role
  // exists, so — matching the Inventory/Assets/Visitor precedent — these are
  // granted to SCHOOL_ADMIN (full) / PRINCIPAL (view, oversight) rather than
  // inventing a new role. Allocate/transfer/vacate/roll-call all fold into
  // hostel.manage (same compose-from-fewer-keys philosophy as the rest of
  // this catalog).
  { key: "hostel.view", module: "hostel", action: "view", description: "View hostels, rooms, beds, residents and roll call" },
  { key: "hostel.manage", module: "hostel", action: "manage", description: "Manage hostels/rooms/beds, allocate/transfer/vacate residents, assign wardens, mark roll call" },

  // Phase 9R — health/infirmary data is more sensitive than ordinary directory
  // access, so it gets its own narrow keys rather than piggy-backing on
  // students.view/hr.view. health.view sees a visit exists (status, dates,
  // patient identity); health.viewSensitive additionally unlocks the factual
  // clinical text (reason, notes, vitals, treatment, medication, profile
  // allergy/condition fields). No permission ever grants diagnosis/prescription
  // authority — there isn't one to grant.
  { key: "health.view", module: "health", action: "view", description: "View that an infirmary visit/profile exists (non-sensitive fields only)" },
  { key: "health.viewSensitive", module: "health", action: "viewSensitive", description: "View sensitive health details: reason, notes, vitals, treatment, medication, allergies/conditions" },
  { key: "health.manage", module: "health", action: "manage", description: "Record infirmary visits, vitals, treatment, medication; manage health profiles" },

  // Phase 9S — Counseling is a SEPARATE confidential domain from Health.
  // counseling.view only ever exposes case METADATA (status, assigned
  // counselor, follow-up date) — never confidential session notes.
  // counseling.viewConfidential is the only key that unlocks note bodies, and
  // is further restricted to the assigned counselor's own cases at the
  // service layer (ownership), not just held-the-permission. counseling.refer
  // is deliberately narrower than .manage — it lets a Teacher open a new case
  // via referral without granting them any read access to case history.
  { key: "counseling.view", module: "counseling", action: "view", description: "View that a counseling case exists (status, assigned counselor, follow-up date — non-confidential metadata only)" },
  { key: "counseling.manage", module: "counseling", action: "manage", description: "Create/assign/close counseling cases and sessions" },
  { key: "counseling.viewConfidential", module: "counseling", action: "viewConfidential", description: "View confidential counseling session notes for the counselor's own assigned cases" },
  { key: "counseling.refer", module: "counseling", action: "refer", description: "Refer a real student to counseling (opens a new case; grants no read access)" },

  // Phase 9T — Cafeteria operations. No financial/payment authority — meal
  // pricing (if recorded) is informational only, never a Fees/Accounting
  // receivable. cafeteria.serve is separate from .manage so a counter
  // operator can record meal service without also being able to edit the
  // menu catalog.
  { key: "cafeteria.view", module: "cafeteria", action: "view", description: "View cafeteria menus, items, and meal service records" },
  { key: "cafeteria.manage", module: "cafeteria", action: "manage", description: "Manage cafeteria locations, items, and menus" },
  { key: "cafeteria.serve", module: "cafeteria", action: "serve", description: "Record meal service to a real Student or Staff" },

  // Phase 9U — Activities/Student Life (clubs, coordinators, memberships,
  // events, participation). No confidentiality tier needed (unlike Health/
  // Counseling) — activity membership/participation is not sensitive data.
  { key: "activities.view", module: "activities", action: "view", description: "View activities, memberships, and events" },
  { key: "activities.manage", module: "activities", action: "manage", description: "Manage activities, coordinators, memberships, and events" },

  { key: "hr.view", module: "hr", action: "view", description: "View HR" },
  { key: "hr.manage", module: "hr", action: "manage", description: "Manage HR" },
  // Phase 9W.2 — self-service: any Staff-linked account can see their own
  // employee profile without holding hr.view (which exposes the whole
  // directory). Identity-scoped (Staff.userId === caller), not a broad grant.
  { key: "hr.viewOwn", module: "hr", action: "viewOwn", description: "View own employee profile (self-service)" },

  // Phase 9W.2 — hierarchical account provisioning. Gates the whole
  // provisioning surface (who is even allowed to try); the separate
  // ROLE_CREATION_POLICY (lib/server/authz/role-creation-policy.ts) then
  // decides WHICH specific roles a holder may grant. Deliberately not named
  // "*.manage" like a domain module — this is cross-cutting identity
  // administration, not a business domain.
  { key: "users.manage", module: "users", action: "manage", description: "Provision, view, and manage user accounts within your authorized scope" },

  { key: "communication.view", module: "communication", action: "view", description: "View communication" },
  { key: "communication.send", module: "communication", action: "send", description: "Send communication" },

  { key: "documents.view", module: "documents", action: "view", description: "View documents" },
  { key: "documents.manage", module: "documents", action: "manage", description: "Manage documents" },
  // Phase 9V — Document Studio: finer-grained than the pre-existing view/manage
  // pair above (which predate the real implementation and stay unused by it).
  { key: "documents.generate", module: "documents", action: "generate", description: "Generate certificates, letters, and ID cards" },
  { key: "documents.manageTemplates", module: "documents", action: "manageTemplates", description: "Create and edit document templates" },
  { key: "documents.void", module: "documents", action: "void", description: "Void a generated document" },

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
  { key: "platform.admins.view", module: "platform.admins", action: "view", description: "View platform administrators" },
  { key: "platform.admins.manage", module: "platform.admins", action: "manage", description: "Manage platform administrators" },
  { key: "platform.announcements.view", module: "platform.announcements", action: "view", description: "View platform announcements" },
  { key: "platform.announcements.manage", module: "platform.announcements", action: "manage", description: "Manage platform announcements" },
  { key: "platform.status.view", module: "platform.status", action: "view", description: "View platform status" },
  { key: "platform.status.manage", module: "platform.status", action: "manage", description: "Manage platform status/incidents" },
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
    "marks.enter", "marks.verify",
    "results.view", "results.publish",
    "promotion.view", "promotion.manage",
    "homework.view", "homework.manage",
    "curriculum.view", "curriculum.manage",
    "lessonPlans.view", "lessonPlans.manage",
    "calendar.view", "calendar.manage",
    "staffAttendance.view", "staffAttendance.manage",
    "leave.submit", "leave.approve",
    "fees.view", "fees.manage", "fees.collect", "fees.refund",
    "accounting.view", "accounting.manage", "accounting.post", "accounting.reverse",
    "payroll.view", "payroll.manage", "payroll.finalize", "payroll.pay",
    "visitors.view", "visitors.manage",
    "transport.view",
    "library.view",
    "inventory.view", "inventory.manage",
    "assets.view", "assets.manage",
    "hostel.view", "hostel.manage",
    "health.view", "health.viewSensitive", "health.manage",
    "counseling.view",
    "cafeteria.view",
    "activities.view",
    "hr.view",
    "communication.view", "communication.send",
    "documents.view", "documents.manage", "documents.generate", "documents.manageTemplates", "documents.void",
    "settings.view", "settings.manage",
    // Phase 9W.2 — top of the school hierarchy: may provision Principal/
    // HR/Transport/Librarian management accounts plus Student/Guardian
    // login foundations directly (see ROLE_CREATION_POLICY).
    "users.manage",
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
    "marks.verify",
    "results.view", "results.publish",
    "promotion.view", "promotion.manage",
    "homework.view", "homework.manage",
    "curriculum.view", "curriculum.manage",
    "lessonPlans.view", "lessonPlans.manage",
    "calendar.view", "calendar.manage",
    "staffAttendance.view", "staffAttendance.manage",
    "leave.submit", "leave.approve",
    "fees.view",
    "accounting.view",
    "payroll.view",
    "visitors.view",
    "inventory.view",
    "assets.view",
    "hostel.view",
    "health.view",
    "counseling.view",
    "cafeteria.view",
    "activities.view",
    "communication.view", "communication.send",
    "documents.view", "documents.generate",
    "settings.view",
    // Phase 9W.2 — may provision Vice Principal/Teacher accounts and
    // Student/Guardian login foundations within their own school.
    "users.manage",
  ],
  // Phase 9W.2 — Vice Principal. Added to the real role architecture (was
  // missing) with an intentionally narrower, operationally-focused
  // permission set than PRINCIPAL: no accounting/payroll/settings/visitors/
  // inventory/assets/hostel/health/counseling/cafeteria/activities view,
  // no admissions.approve — those stay a PRINCIPAL/SCHOOL_ADMIN-tier
  // decision. Academic/operational day-to-day management only.
  VICE_PRINCIPAL: [
    "dashboard.view",
    "students.view",
    "guardians.view",
    "academics.view", "academics.manage",
    "attendance.view",
    "timetable.view", "timetable.manage",
    "exams.view", "exams.manage",
    "marks.verify",
    "results.view",
    "promotion.view",
    "homework.view", "homework.manage",
    "curriculum.view", "curriculum.manage",
    "lessonPlans.view", "lessonPlans.manage",
    "calendar.view", "calendar.manage",
    "staffAttendance.view", "staffAttendance.manage",
    "leave.submit", "leave.approve",
    "communication.view", "communication.send",
    "documents.view",
    // Phase 9W.2 — may provision Teacher accounts and Student login
    // foundations (narrower than PRINCIPAL: no Guardian provisioning).
    "users.manage",
  ],
  TEACHER: [
    "dashboard.view",
    "students.view",
    "guardians.view",
    "academics.view",
    "attendance.view", "attendance.mark",
    "timetable.view",
    "exams.view",
    "marks.enter",
    "results.view",
    "promotion.view",
    "homework.view", "homework.manage",
    "curriculum.view", "curriculum.manage",
    "lessonPlans.view", "lessonPlans.manage",
    "calendar.view",
    "leave.submit",
    "communication.send",
    "documents.view",
    "counseling.refer",
  ],
  LIBRARIAN: ["dashboard.view", "students.view", "library.view", "library.manage"],
  TRANSPORT_MANAGER: [
    "dashboard.view", "transport.view", "transport.manage",
    // Phase 9W.2 — may provision a bare operational login for real Staff in
    // transport scope (drivers/attendants); see ROLE_CREATION_POLICY.
    "users.manage",
  ],
  HR_ADMIN: [
    "dashboard.view", "hr.view", "hr.manage", "staffAttendance.view", "staffAttendance.manage",
    "leave.submit", "leave.approve", "documents.view", "documents.generate",
    // Phase 9W.2 — may provision a bare operational Staff login for any real,
    // unlinked Staff record HR policy permits; see ROLE_CREATION_POLICY.
    "users.manage",
  ],
  // Phase 9W.2 — generic minimal self-service identity for a Staff member who
  // needs to log in but holds no administrative role (provisioned by
  // HR_ADMIN or TRANSPORT_MANAGER — one shared role, not a parallel
  // "TRANSPORT_STAFF" vocabulary with identical permissions). Deliberately
  // narrow: own profile + leave self-service only, nothing else.
  STAFF: ["dashboard.view", "hr.viewOwn", "leave.submit"],
  // Phase 9W.2 — account foundation only (no student portal built yet).
  // Deliberately empty permission set: this role exists so login/context
  // resolution and capability reporting work correctly and honestly; the
  // landing page identifies the student via the real Student.userId link,
  // not via a permission grant.
  STUDENT: [],
  // Phase 9W.2 — account foundation only (no parent portal built yet). Same
  // reasoning as STUDENT: identity via Guardian.userId, not permissions.
  GUARDIAN: [],
  // Phase 9S — the only role holding counseling.viewConfidential. No senior/
  // junior tier exists, so ownership (assignedCounselorStaffId == own Staff.id)
  // is enforced uniformly at the service layer for every COUNSELOR, never
  // bypassed by holding this role — see lib/server/counseling/access.ts.
  COUNSELOR: ["dashboard.view", "students.view", "counseling.view", "counseling.manage", "counseling.viewConfidential", "counseling.refer"],
  // Phase 9T — mirrors the LIBRARIAN/TRANSPORT_MANAGER/COUNSELOR precedent:
  // SCHOOL_ADMIN gets view only, the dedicated specialist role gets manage.
  CAFETERIA_MANAGER: ["dashboard.view", "students.view", "cafeteria.view", "cafeteria.manage", "cafeteria.serve"],
  // Phase 9U — same precedent: SCHOOL_ADMIN/PRINCIPAL get view only, the
  // dedicated specialist role gets manage. No ownership-restriction tier
  // (unlike COUNSELOR) — activities data isn't confidential, so any
  // activities.manage holder may manage any activity, matching the Hostel/
  // Library/Cafeteria "broad specialist access" pattern.
  ACTIVITY_COORDINATOR: ["dashboard.view", "students.view", "activities.view", "activities.manage"],
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

// ---------------------------------------------------------------------------
// Platform role → area access matrix, DERIVED from the REAL catalog above
// (PERMISSIONS + PLATFORM_ROLE_PERMISSIONS). This is the truthful source for the
// Super Admin "Permissions" reference page — no hardcoded/mock matrix. A cell is
// "manage" when the role holds the module's `.manage` key, "view" when it holds
// any of the module's keys, else null.
// ---------------------------------------------------------------------------
export const PLATFORM_MATRIX_ROLES = ["SUPER_ADMIN", "SUPPORT", "BILLING", "AUDITOR"] as const;

const PLATFORM_ROLE_LABELS: Record<string, string> = { SUPER_ADMIN: "Super Admin", SUPPORT: "Support", BILLING: "Billing", AUDITOR: "Auditor" };

/** Human label for a `platform.<module>` permission module. */
function platformAreaLabel(module: string): string {
  const seg = module.replace(/^platform\./, "").replace(/_/g, " ");
  return seg.replace(/\b\w/g, (c) => c.toUpperCase());
}

export type PlatformMatrix = {
  roles: { key: string; label: string }[];
  areas: { key: string; label: string }[];
  matrix: Record<string, Record<string, "manage" | "view" | null>>;
};

/** Build the real platform role → area capability matrix from the catalog. */
export function buildPlatformPermissionMatrix(): PlatformMatrix {
  const areaKeys = [...new Set(PERMISSIONS.filter((p) => p.key.startsWith("platform.")).map((p) => p.module))];
  const areas = areaKeys.map((key) => ({ key, label: platformAreaLabel(key) }));
  const matrix: Record<string, Record<string, "manage" | "view" | null>> = {};
  for (const role of PLATFORM_MATRIX_ROLES) {
    const granted = new Set(platformPermissionsForRole(role));
    matrix[role] = {};
    for (const area of areaKeys) {
      matrix[role][area] = granted.has(`${area}.manage`)
        ? "manage"
        : [...granted].some((k) => k.startsWith(`${area}.`))
          ? "view"
          : null;
    }
  }
  return { roles: PLATFORM_MATRIX_ROLES.map((key) => ({ key, label: PLATFORM_ROLE_LABELS[key] })), areas, matrix };
}

// Bridge: DB system-role key → the existing UI `UserRole` value, so the client
// PermissionsProvider can render for the user's REAL active role (not a mock
// default). Platform admins map to the UI "super-admin" role.
export const DB_ROLE_TO_UI: Record<string, string> = {
  SCHOOL_ADMIN: "administrator",
  PRINCIPAL: "principal",
  VICE_PRINCIPAL: "vice-principal",
  TEACHER: "teacher",
  LIBRARIAN: "librarian",
  TRANSPORT_MANAGER: "transport-manager",
  HR_ADMIN: "hr-manager",
  COUNSELOR: "counsellor",
  CAFETERIA_MANAGER: "cafeteria-manager",
  ACTIVITY_COORDINATOR: "activities-coordinator",
  STAFF: "staff",
  STUDENT: "student",
  GUARDIAN: "parent",
};
export const PLATFORM_UI_ROLE = "super-admin";

