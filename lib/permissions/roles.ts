export type UserRole =
  | "super-admin"
  | "school-owner"
  | "principal"
  | "examination-controller"
  | "academic-coordinator"
  | "admission-officer"
  | "administrator"
  | "finance-administrator"
  | "accountant"
  | "cashier"
  | "teacher"
  | "parent"
  | "student"
  | "auditor";

export const roleLabels: Record<UserRole, string> = {
  "super-admin": "Super Admin",
  "school-owner": "School Owner",
  principal: "Principal",
  "examination-controller": "Examination Controller",
  "academic-coordinator": "Academic Coordinator",
  "admission-officer": "Admission Officer",
  administrator: "Administrator",
  "finance-administrator": "Finance Administrator",
  accountant: "Accountant",
  cashier: "Cashier",
  teacher: "Teacher",
  parent: "Parent",
  student: "Student",
  auditor: "Auditor",
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
  | "calendar.manage"
  // Phase 4 — examinations, marks, results, report cards, promotion
  | "exams.view"
  | "exams.create"
  | "exams.manageSchedule"
  | "exams.manageSubjects"
  | "exams.manageAttendance"
  | "exams.publishSchedule"
  | "grading.manage"
  | "marks.enter"
  | "marks.import"
  | "marks.verify"
  | "marks.approve"
  | "marks.lock"
  | "results.view"
  | "results.viewAnalytics"
  | "results.calculate"
  | "results.publish"
  | "reportCards.view"
  | "reportCards.manageTemplates"
  | "reportCards.generate"
  | "reportCards.publish"
  | "promotion.view"
  | "promotion.run"
  | "promotion.approve"
  // Phase 5 — fees, accounting and payroll
  | "finance.viewDashboard"
  | "finance.auditView"
  | "fees.manageStructures"
  | "fees.assign"
  | "fees.viewDues"
  | "fees.remind"
  | "fees.manageDiscounts"
  | "fees.manageScholarships"
  | "fees.manageConcessions"
  | "fees.manageLateFees"
  | "fees.refund"
  | "fees.approveRefund"
  | "fees.reconcile"
  | "fees.viewReports"
  | "fees.managePaymentLinks"
  | "fees.viewOwn"
  | "fees.payOwn"
  | "accounting.view"
  | "accounting.manageIncome"
  | "accounting.manageExpenses"
  | "accounting.approveExpenses"
  | "accounting.manageVendors"
  | "accounting.managePurchaseOrders"
  | "accounting.approvePurchaseOrders"
  | "accounting.manageChartOfAccounts"
  | "accounting.postJournals"
  | "accounting.viewLedger"
  | "accounting.manageBank"
  | "accounting.manageBudgets"
  | "accounting.approveBudgets"
  | "accounting.viewReports"
  | "payroll.view"
  | "payroll.manageStructures"
  | "payroll.run"
  | "payroll.approve"
  | "payroll.viewPayslips"
  | "payroll.manageLoans";

// Named permission groups for the Phase 5 finance domain — several roles
// share most of a group (e.g. every finance-facing role gets ALL_FEES_VIEW),
// so composing from these keeps the matrix below readable instead of
// repeating the same 10+ keys verbatim in five different role arrays.
const FEES_OPERATE: Permission[] = [
  "fees.view",
  "fees.record",
  "fees.assign",
  "fees.viewDues",
  "fees.remind",
  "fees.reconcile",
  "fees.managePaymentLinks",
  "fees.viewReports",
  "fees.refund",
];
const FEES_MANAGE: Permission[] = [...FEES_OPERATE, "fees.manageStructures", "fees.manageDiscounts", "fees.manageScholarships", "fees.manageConcessions", "fees.manageLateFees", "fees.approveRefund"];
const FEES_OVERSIGHT: Permission[] = ["fees.view", "fees.viewDues", "fees.viewReports", "fees.approveRefund"];

const ACCOUNTING_OPERATE: Permission[] = [
  "accounting.view",
  "accounting.manageIncome",
  "accounting.manageExpenses",
  "accounting.manageVendors",
  "accounting.managePurchaseOrders",
  "accounting.viewLedger",
  "accounting.manageBank",
  "accounting.viewReports",
];
const ACCOUNTING_MANAGE: Permission[] = [...ACCOUNTING_OPERATE, "accounting.approveExpenses", "accounting.approvePurchaseOrders", "accounting.manageChartOfAccounts", "accounting.postJournals", "accounting.manageBudgets", "accounting.approveBudgets"];
const ACCOUNTING_OVERSIGHT: Permission[] = ["accounting.view", "accounting.viewReports", "accounting.approveExpenses", "accounting.approvePurchaseOrders", "accounting.approveBudgets"];

const PAYROLL_MANAGE: Permission[] = ["payroll.view", "payroll.manageStructures", "payroll.run", "payroll.approve", "payroll.viewPayslips", "payroll.manageLoans"];
const PAYROLL_OVERSIGHT: Permission[] = ["payroll.view", "payroll.approve"];

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
    "exams.view",
    "exams.create",
    "exams.manageSchedule",
    "exams.manageSubjects",
    "exams.manageAttendance",
    "exams.publishSchedule",
    "grading.manage",
    "marks.enter",
    "marks.import",
    "marks.verify",
    "marks.approve",
    "marks.lock",
    "results.view",
    "results.viewAnalytics",
    "results.calculate",
    "results.publish",
    "reportCards.view",
    "reportCards.manageTemplates",
    "reportCards.generate",
    "reportCards.publish",
    "promotion.view",
    "promotion.run",
    "promotion.approve",
    "finance.viewDashboard",
    "finance.auditView",
    ...FEES_MANAGE,
    ...ACCOUNTING_MANAGE,
    ...PAYROLL_MANAGE,
  ],
  "school-owner": [
    "admissions.view",
    "admissions.approve",
    "students.view",
    "students.viewSensitive",
    "documents.verify",
    "parents.view",
    "communication.send",
    "academics.view",
    "attendance.viewAny",
    "staffAttendance.view",
    "timetable.view",
    "calendar.manage",
    "exams.view",
    "results.view",
    "results.viewAnalytics",
    "reportCards.view",
    "promotion.view",
    "promotion.approve",
    "finance.viewDashboard",
    "finance.auditView",
    ...FEES_OVERSIGHT,
    ...ACCOUNTING_OVERSIGHT,
    ...PAYROLL_OVERSIGHT,
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
    "exams.view",
    "results.view",
    "results.viewAnalytics",
    "results.publish",
    "marks.approve",
    "reportCards.view",
    "reportCards.publish",
    "promotion.view",
    "promotion.approve",
    "finance.viewDashboard",
    "finance.auditView",
    ...FEES_OVERSIGHT,
    ...ACCOUNTING_OVERSIGHT,
    ...PAYROLL_OVERSIGHT,
  ],
  "examination-controller": [
    "students.view",
    "academics.view",
    "communication.send",
    "exams.view",
    "exams.create",
    "exams.manageSchedule",
    "exams.manageSubjects",
    "exams.manageAttendance",
    "exams.publishSchedule",
    "grading.manage",
    "marks.enter",
    "marks.import",
    "marks.verify",
    "marks.approve",
    "marks.lock",
    "results.view",
    "results.viewAnalytics",
    "results.calculate",
    "results.publish",
    "reportCards.view",
    "reportCards.manageTemplates",
    "reportCards.generate",
    "reportCards.publish",
    "promotion.view",
    "promotion.run",
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
    "exams.view",
    "exams.create",
    "exams.manageSchedule",
    "exams.manageSubjects",
    "grading.manage",
    "marks.verify",
    "results.view",
    "results.viewAnalytics",
    "results.calculate",
    "reportCards.view",
    "reportCards.manageTemplates",
    "reportCards.generate",
    "promotion.view",
    "promotion.run",
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
    "fees.view",
    "fees.record",
  ],
  "finance-administrator": [
    "students.view",
    "parents.view",
    "communication.send",
    "finance.viewDashboard",
    "finance.auditView",
    ...FEES_MANAGE,
    ...ACCOUNTING_MANAGE,
    ...PAYROLL_MANAGE,
  ],
  cashier: ["students.view", "fees.view", "fees.record", "finance.viewDashboard"],
  // Strictly read-only — an auditor never gets an approve/manage/record permission,
  // even ones oversight roles like principal or school-owner hold.
  auditor: [
    "students.view",
    "parents.view",
    "academics.view",
    "exams.view",
    "results.view",
    "reportCards.view",
    "promotion.view",
    "finance.viewDashboard",
    "finance.auditView",
    "fees.view",
    "fees.viewDues",
    "fees.viewReports",
    "accounting.view",
    "accounting.viewLedger",
    "accounting.viewReports",
    "payroll.view",
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
    "exams.view",
    "results.view",
    "reportCards.view",
    "reportCards.generate",
    "promotion.view",
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
    "exams.view",
    "marks.enter",
    "marks.import",
    "marks.verify",
    "results.view",
    "reportCards.view",
  ],
  accountant: ["students.view", "parents.view", "finance.viewDashboard", "payroll.view", "payroll.viewPayslips", "accounting.postJournals", ...FEES_OPERATE, ...ACCOUNTING_OPERATE],
  parent: [
    "students.view",
    "fees.view",
    "fees.viewOwn",
    "fees.payOwn",
    "communication.send",
    "academics.view",
    "attendance.viewOwn",
    "timetable.view",
    "homework.submit",
    "exams.view",
    "results.view",
    "reportCards.view",
  ],
  student: [
    "students.view",
    "academics.view",
    "attendance.viewOwn",
    "timetable.view",
    "homework.submit",
    "exams.view",
    "results.view",
    "reportCards.view",
    "fees.viewOwn",
    "fees.payOwn",
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}

export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

export const allRoles: UserRole[] = [
  "super-admin",
  "school-owner",
  "principal",
  "examination-controller",
  "academic-coordinator",
  "admission-officer",
  "administrator",
  "finance-administrator",
  "accountant",
  "cashier",
  "teacher",
  "parent",
  "student",
  "auditor",
];
