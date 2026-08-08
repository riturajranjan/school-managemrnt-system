// ---------------------------------------------------------------------------
// RBAC foundation catalog — the seed source of truth for permissions and
// system roles, and the fixture the pure authorization core is tested against.
//
// This is intentionally a FOUNDATION slice, not the full ~250-permission
// frontend matrix (lib/permissions/roles.ts). Later module phases add their own
// permissions to the DB catalog; the architecture below scales to that without
// change. Plain module (no server-only) so tests and the seed can both import.
// ---------------------------------------------------------------------------

export type PermissionDef = { key: string; module: string; description: string };

// Foundation permissions: tenancy/identity/settings administration plus a
// representative slice of module actions so guards can be exercised end-to-end.
export const PERMISSIONS = [
  // Tenancy & organization
  { key: "tenant.view", module: "tenant", description: "View tenant details" },
  { key: "tenant.manage", module: "tenant", description: "Update tenant settings" },
  { key: "school.view", module: "school", description: "View schools" },
  { key: "school.create", module: "school", description: "Create schools" },
  { key: "school.update", module: "school", description: "Update schools" },
  { key: "school.archive", module: "school", description: "Archive schools" },
  { key: "branch.view", module: "branch", description: "View branches" },
  { key: "branch.manage", module: "branch", description: "Create/update branches" },
  { key: "session.view", module: "session", description: "View academic sessions" },
  { key: "session.manage", module: "session", description: "Create/update academic sessions" },
  // Identity & access administration
  { key: "user.view", module: "user", description: "View users" },
  { key: "user.invite", module: "user", description: "Invite users" },
  { key: "user.manage", module: "user", description: "Update/deactivate users" },
  { key: "membership.manage", module: "membership", description: "Manage tenant memberships" },
  { key: "role.view", module: "role", description: "View roles & permissions" },
  { key: "role.manage", module: "role", description: "Create/update custom roles" },
  { key: "settings.manage", module: "settings", description: "Manage school configuration" },
  { key: "audit.view", module: "audit", description: "View audit log" },
  // Representative module actions (full matrices land in later phases)
  { key: "student.view", module: "student", description: "View students" },
  { key: "student.create", module: "student", description: "Create students" },
  { key: "student.update", module: "student", description: "Update students" },
  { key: "student.archive", module: "student", description: "Archive students" },
  { key: "attendance.view", module: "attendance", description: "View attendance" },
  { key: "attendance.mark", module: "attendance", description: "Mark attendance" },
  { key: "fees.view", module: "fees", description: "View fees" },
  { key: "fees.collect", module: "fees", description: "Collect fee payments" },
  { key: "fees.refund", module: "fees", description: "Issue fee refunds" },
  { key: "fees.approve", module: "fees", description: "Approve fee adjustments" },
  { key: "exam.view", module: "exam", description: "View exams" },
  { key: "exam.manage", module: "exam", description: "Manage exams" },
  { key: "result.publish", module: "result", description: "Publish results" },
  { key: "library.view", module: "library", description: "View library" },
  { key: "library.circulate", module: "library", description: "Issue/return library items" },
] as const satisfies readonly PermissionDef[];

export type PermissionKey = (typeof PERMISSIONS)[number]["key"];

const ALL_KEYS: PermissionKey[] = PERMISSIONS.map((p) => p.key);

export function isKnownPermission(key: string): key is PermissionKey {
  return (ALL_KEYS as string[]).includes(key);
}

export type SystemRoleDef = {
  key: string;
  name: string;
  description: string;
  permissions: PermissionKey[];
};

// Helper: "everything except this list" — keeps broad admin roles readable and
// self-updating as the catalog grows.
const allExcept = (...omit: PermissionKey[]): PermissionKey[] => ALL_KEYS.filter((k) => !omit.includes(k));

// System (global) roles. NOTE: SUPER_ADMIN is deliberately absent — platform
// super admin is NOT a tenant role; it lives in PlatformAdmin. See requirement
// #17 (Super Admin separation).
export const SYSTEM_ROLES = [
  {
    key: "SCHOOL_ADMIN",
    name: "School Administrator",
    description: "Full administrative access within the tenant.",
    // Broad, but never platform-level. Excludes nothing tenant-scoped.
    permissions: allExcept(),
  },
  {
    key: "PRINCIPAL",
    name: "Principal",
    description: "School leadership oversight.",
    permissions: [
      "tenant.view", "school.view", "branch.view", "session.view", "session.manage",
      "user.view", "role.view", "settings.manage", "audit.view",
      "student.view", "student.update", "attendance.view",
      "fees.view", "fees.approve", "exam.view", "exam.manage", "result.publish", "library.view",
    ],
  },
  {
    key: "ACADEMIC_COORDINATOR",
    name: "Academic Coordinator",
    description: "Academics, exams and results coordination.",
    permissions: [
      "school.view", "branch.view", "session.view",
      "student.view", "attendance.view", "attendance.mark",
      "exam.view", "exam.manage", "result.publish",
    ],
  },
  {
    key: "TEACHER",
    name: "Teacher",
    description: "Classroom teaching staff.",
    permissions: ["school.view", "branch.view", "session.view", "student.view", "attendance.view", "attendance.mark", "exam.view", "library.view"],
  },
  {
    key: "ACCOUNTANT",
    name: "Accountant",
    description: "Fees and finance operations.",
    permissions: ["school.view", "branch.view", "session.view", "student.view", "fees.view", "fees.collect", "fees.refund"],
  },
  {
    key: "HR_ADMIN",
    name: "HR Administrator",
    description: "People and staff administration.",
    permissions: ["school.view", "branch.view", "user.view", "user.invite", "membership.manage"],
  },
  {
    key: "LIBRARIAN",
    name: "Librarian",
    description: "Library circulation and catalogue.",
    permissions: ["school.view", "branch.view", "student.view", "library.view", "library.circulate"],
  },
  {
    key: "TRANSPORT_MANAGER",
    name: "Transport Manager",
    description: "Transport operations.",
    permissions: ["school.view", "branch.view", "student.view"],
  },
  {
    key: "RECEPTIONIST",
    name: "Receptionist",
    description: "Front desk and enquiries.",
    permissions: ["school.view", "branch.view", "student.view"],
  },
  {
    key: "PARENT",
    name: "Parent",
    description: "Guardian portal access (own children).",
    permissions: ["student.view", "attendance.view", "fees.view", "exam.view", "result.publish"],
  },
  {
    key: "STUDENT",
    name: "Student",
    description: "Student portal access (own records).",
    permissions: ["student.view", "attendance.view", "exam.view", "library.view"],
  },
  {
    key: "AUDITOR",
    name: "Auditor",
    description: "Strictly read-only oversight across the tenant.",
    // Only ever *.view / audit.view — never an approve/manage/collect action.
    permissions: ALL_KEYS.filter((k) => k.endsWith(".view")),
  },
] as const satisfies readonly SystemRoleDef[];

export type SystemRoleKey = (typeof SYSTEM_ROLES)[number]["key"];
