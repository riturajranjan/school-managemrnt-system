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
  { key: "super_admin.access", module: "super_admin", action: "access", description: "Access the platform control center" },
];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

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

