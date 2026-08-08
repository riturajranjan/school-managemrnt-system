import type { Db } from "@/lib/data/store";
import { hasPermission, type Permission, type UserRole } from "@/lib/permissions/roles";

// ---------------------------------------------------------------------------
// System readiness — mock configuration checks that drive the dashboard visual.
// ---------------------------------------------------------------------------

export type ReadinessCheck = { key: string; label: string; done: boolean; hint: string; href: string };

export function systemReadiness(db: Db): { percent: number; checks: ReadinessCheck[]; completed: number; total: number; nextStep?: ReadinessCheck } {
  const a = db.admin;
  const checks: ReadinessCheck[] = [
    { key: "school", label: "School profile complete", done: Boolean(a.schoolProfile.name && a.schoolProfile.affiliationNumber), hint: "Name, board and affiliation set", href: "/settings/school" },
    { key: "branches", label: "Branch configuration", done: a.branches.every((b) => b.status !== "setup-pending"), hint: `${a.branches.filter((b) => b.status === "setup-pending").length} branch(es) pending`, href: "/settings/branches" },
    { key: "session", label: "Academic session active", done: a.sessions.some((s) => s.status === "active"), hint: "An active session is configured", href: "/settings/academic-sessions" },
    { key: "roles", label: "Roles created", done: a.roles.length > 0, hint: `${a.roles.length} roles defined`, href: "/settings/roles" },
    { key: "permissions", label: "Permissions reviewed", done: a.roles.length >= 8, hint: "Permission matrix reviewed", href: "/settings/permissions" },
    { key: "branding", label: "Branding configured", done: Boolean(a.branding.primaryColor), hint: "Colours and assets set", href: "/settings/branding" },
    { key: "notifications", label: "Notification settings", done: a.notifications.length > 0, hint: "Channels configured", href: "/settings/notifications" },
    { key: "numbering", label: "Document numbering", done: a.numbering.length > 0, hint: `${a.numbering.length} numbering rules`, href: "/settings/numbering" },
    { key: "modules", label: "Module visibility", done: a.modules.some((m) => m.enabled), hint: `${a.modules.filter((m) => m.enabled).length} modules enabled`, href: "/settings/modules" },
    { key: "integrations", label: "Integration placeholders", done: a.integrations.length > 0, hint: "Placeholders ready to connect", href: "/settings/integrations" },
  ];
  const completed = checks.filter((c) => c.done).length;
  const percent = Math.round((completed / checks.length) * 100);
  const nextStep = checks.find((c) => !c.done);
  return { percent, checks, completed, total: checks.length, nextStep };
}

// ---------------------------------------------------------------------------
// Permission matrix — derived from the REAL rolePermissions via hasPermission.
// Each (module, action) maps to representative permission strings; a role "has"
// the capability if it holds any of them.
// ---------------------------------------------------------------------------

export type MatrixAction = "view" | "create" | "edit" | "delete" | "approve" | "export" | "manage";
export const matrixActions: MatrixAction[] = ["view", "create", "edit", "delete", "approve", "export", "manage"];

export type MatrixModule = { id: string; label: string };
export const matrixModules: MatrixModule[] = [
  { id: "dashboard", label: "Dashboard" }, { id: "students", label: "Students" }, { id: "admissions", label: "Admissions" },
  { id: "attendance", label: "Attendance" }, { id: "academics", label: "Academics" }, { id: "exams", label: "Exams" },
  { id: "fees", label: "Fees" }, { id: "transport", label: "Transport" }, { id: "library", label: "Library" },
  { id: "hr", label: "HR" }, { id: "communication", label: "Communication" }, { id: "hostel", label: "Hostel" },
  { id: "health", label: "Health" }, { id: "cafeteria", label: "Cafeteria" }, { id: "activities", label: "Activities" },
  { id: "documents", label: "Documents" }, { id: "settings", label: "Settings" },
];

// Maps a (module, action) to candidate permission strings. Absence = capability
// is not represented (rendered as "—").
const MATRIX: Record<string, Partial<Record<MatrixAction, Permission[]>>> = {
  dashboard: { view: ["students.view"] },
  students: { view: ["students.view"], create: ["students.create"], edit: ["students.edit"], delete: ["students.archive"], export: ["students.import"], manage: ["students.edit"] },
  admissions: { view: ["admissions.view"], create: ["admissions.create"], edit: ["admissions.edit"], approve: ["admissions.approve"], delete: ["admissions.delete"], manage: ["admissions.assignStaff"] },
  attendance: { view: ["attendance.viewAny", "attendance.viewOwn"], create: ["attendance.markAny", "attendance.markOwn"], edit: ["attendance.markAny"], manage: ["attendance.configureRules"] },
  academics: { view: ["academics.view"], create: ["lessonPlans.create"], edit: ["homework.manage"], approve: ["lessonPlans.approve"], manage: ["academics.manageClasses"] },
  exams: { view: ["exams.view"], create: ["exams.create"], edit: ["marks.enter"], approve: ["marks.approve"], export: ["results.viewAnalytics"], manage: ["exams.manageSchedule"] },
  fees: { view: ["fees.view", "fees.viewOwn"], create: ["fees.record"], edit: ["fees.assign"], approve: ["fees.approveRefund"], export: ["fees.viewReports"], manage: ["fees.manageStructures"] },
  transport: { view: ["transport.view", "transport.viewOwn"], create: ["transport.manageTrips"], edit: ["transport.assignStudents"], export: ["transport.viewReports"], manage: ["transport.manageRoutes"] },
  library: { view: ["library.view", "library.viewOwn"], create: ["library.manageCatalogue"], edit: ["library.circulate"], export: ["library.viewReports"], manage: ["library.manageSettings"] },
  hr: { view: ["hr.view", "hr.viewOwn"], create: ["hr.manageStaff"], edit: ["hr.manageStaff"], approve: ["hr.approveLeave"], export: ["hr.viewAnalytics"], manage: ["hr.manageDepartments"] },
  communication: { view: ["comm.view", "comm.viewOwn"], create: ["comm.message"], approve: ["comm.manageAnnouncements"], export: ["comm.viewAnalytics"], manage: ["comm.manageSettings"] },
  hostel: { view: ["hostel.view", "hostel.viewOwn"], edit: ["hostel.attendance"], manage: ["hostel.manage"] },
  health: { view: ["health.view", "health.viewOwn"], edit: ["health.manage"], manage: ["health.viewSensitive"] },
  cafeteria: { view: ["cafeteria.view", "cafeteria.viewOwn"], create: ["cafeteria.order"], manage: ["cafeteria.manage"] },
  activities: { view: ["activities.view", "activities.viewOwn"], create: ["activities.manageEvents"], approve: ["activities.recordResults"], export: ["activities.viewAnalytics"], manage: ["activities.manageHouses"] },
  documents: { view: ["documents.view", "documents.viewOwn"], create: ["documents.generate"], edit: ["documents.manageTemplates"], delete: ["documents.revoke"], export: ["documents.batch"], manage: ["documents.manageSettings"] },
  settings: { view: ["documents.viewAnalytics"], manage: ["documents.manageSettings"] },
};

export function roleCan(role: UserRole, moduleId: string, action: MatrixAction): "yes" | "no" | "na" {
  const perms = MATRIX[moduleId]?.[action];
  if (!perms) return "na";
  return perms.some((p) => hasPermission(role, p)) ? "yes" : "no";
}

export function roleCapabilityCount(role: UserRole): number {
  let n = 0;
  for (const m of matrixModules) for (const a of matrixActions) if (roleCan(role, m.id, a) === "yes") n++;
  return n;
}

// Role comparison — shared vs additional capabilities between two roles.
export function compareRoles(a: UserRole, b: UserRole): { shared: string[]; onlyA: string[]; onlyB: string[] } {
  const shared: string[] = [], onlyA: string[] = [], onlyB: string[] = [];
  for (const m of matrixModules) for (const act of matrixActions) {
    const ca = roleCan(a, m.id, act) === "yes";
    const cb = roleCan(b, m.id, act) === "yes";
    const label = `${m.label} · ${act}`;
    if (ca && cb) shared.push(label);
    else if (ca) onlyA.push(label);
    else if (cb) onlyB.push(label);
  }
  return { shared, onlyA, onlyB };
}
