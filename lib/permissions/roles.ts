export type UserRole =
  | "super-admin"
  | "principal"
  | "academic-coordinator"
  | "admission-officer"
  | "administrator"
  | "teacher"
  | "accountant"
  | "parent"
  | "student";

export const roleLabels: Record<UserRole, string> = {
  "super-admin": "Super Admin",
  principal: "Principal",
  "academic-coordinator": "Academic Coordinator",
  "admission-officer": "Admission Officer",
  administrator: "Administrator",
  teacher: "Teacher",
  accountant: "Accountant",
  parent: "Parent",
  student: "Student",
};

export type Permission =
  | "admissions.view"
  | "admissions.create"
  | "admissions.edit"
  | "admissions.approve"
  | "admissions.delete"
  | "admissions.assignStaff"
  | "students.view"
  | "students.viewSensitive"
  | "students.create"
  | "students.edit"
  | "students.archive"
  | "students.import"
  | "documents.verify"
  | "documents.upload"
  | "fees.view"
  | "fees.record"
  | "parents.view"
  | "parents.manage"
  | "parents.managePortal"
  | "communication.send"
  // Phase 3 — academics
  | "academics.view"
  | "academics.manageClasses"
  | "academics.manageSubjects"
  | "academics.manageCurriculum"
  | "lessonPlans.create"
  | "lessonPlans.approve"
  | "homework.manage"
  | "homework.submit"
  | "attendance.markOwn"
  | "attendance.markAny"
  | "attendance.viewOwn"
  | "attendance.viewAny"
  | "attendance.configureRules"
  | "leave.submit"
  | "leave.approve"
  | "staffAttendance.view"
  | "staffAttendance.manage"
  | "timetable.view"
  | "timetable.manage"
  | "timetable.publish"
  | "calendar.manage";

// Static role → permission matrix. In production this would be fetched
// per-tenant from the backend; kept as a typed constant here so both UI
// gating and the mock service layer can import the same source of truth.
const rolePermissions: Record<UserRole, Permission[]> = {
  "super-admin": [
    "admissions.view",
    "admissions.create",
    "admissions.edit",
    "admissions.approve",
    "admissions.delete",
    "admissions.assignStaff",
    "students.view",
    "students.viewSensitive",
    "students.create",
    "students.edit",
    "students.archive",
    "students.import",
    "documents.verify",
    "documents.upload",
    "fees.view",
    "fees.record",
    "parents.view",
    "parents.manage",
    "parents.managePortal",
    "communication.send",
    "academics.view",
    "academics.manageClasses",
    "academics.manageSubjects",
    "academics.manageCurriculum",
    "lessonPlans.create",
    "lessonPlans.approve",
    "homework.manage",
    "attendance.markOwn",
    "attendance.markAny",
    "attendance.viewOwn",
    "attendance.viewAny",
    "attendance.configureRules",
    "leave.submit",
    "leave.approve",
    "staffAttendance.view",
    "staffAttendance.manage",
    "timetable.view",
    "timetable.manage",
    "timetable.publish",
    "calendar.manage",
  ],
  principal: [
    "admissions.view",
    "admissions.approve",
    "admissions.assignStaff",
    "students.view",
    "students.viewSensitive",
    "students.edit",
    "students.archive",
    "documents.verify",
    "fees.view",
    "parents.view",
    "parents.manage",
    "communication.send",
    "academics.view",
    "lessonPlans.approve",
    "homework.manage",
    "attendance.viewAny",
    "attendance.configureRules",
    "leave.approve",
    "staffAttendance.view",
    "timetable.view",
    "timetable.publish",
    "calendar.manage",
  ],
  "academic-coordinator": [
    "students.view",
    "academics.view",
    "academics.manageClasses",
    "academics.manageSubjects",
    "academics.manageCurriculum",
    "lessonPlans.create",
    "lessonPlans.approve",
    "homework.manage",
    "attendance.viewAny",
    "attendance.configureRules",
    "timetable.view",
    "timetable.manage",
    "timetable.publish",
    "calendar.manage",
    "communication.send",
  ],
  "admission-officer": [
    "admissions.view",
    "admissions.create",
    "admissions.edit",
    "admissions.assignStaff",
    "documents.verify",
    "documents.upload",
    "students.view",
    "students.create",
    "parents.view",
    "parents.managePortal",
    "communication.send",
  ],
  administrator: [
    "admissions.view",
    "students.view",
    "students.edit",
    "students.create",
    "students.import",
    "documents.verify",
    "documents.upload",
    "parents.view",
    "parents.manage",
    "parents.managePortal",
    "communication.send",
    "academics.view",
    "academics.manageClasses",
    "academics.manageSubjects",
    "attendance.viewAny",
    "leave.approve",
    "staffAttendance.view",
    "staffAttendance.manage",
    "timetable.view",
    "calendar.manage",
  ],
  teacher: [
    "students.view",
    "documents.upload",
    "communication.send",
    "academics.view",
    "lessonPlans.create",
    "homework.manage",
    "attendance.markOwn",
    "attendance.viewOwn",
    "leave.submit",
    "timetable.view",
  ],
  accountant: ["students.view", "fees.view", "fees.record", "parents.view"],
  parent: ["students.view", "fees.view", "communication.send", "academics.view", "attendance.viewOwn", "timetable.view", "homework.submit"],
  student: ["students.view", "academics.view", "attendance.viewOwn", "timetable.view", "homework.submit"],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}

export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

export const allRoles: UserRole[] = [
  "super-admin",
  "principal",
  "academic-coordinator",
  "admission-officer",
  "administrator",
  "teacher",
  "accountant",
  "parent",
  "student",
];
