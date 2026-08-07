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
  | "transport-administrator"
  | "transport-manager"
  | "dispatcher"
  | "driver"
  | "attendant"
  | "mechanic"
  | "receptionist"
  | "teacher"
  | "parent"
  | "student"
  | "auditor"
  // Phase 7 — library, inventory and asset operations
  | "librarian"
  | "assistant-librarian"
  | "inventory-manager"
  | "storekeeper"
  | "department-head"
  // Phase 8 — HR & people operations
  | "hr-manager"
  | "hr-executive"
  | "recruiter";

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
  "transport-administrator": "Transport Administrator",
  "transport-manager": "Transport Manager",
  dispatcher: "Dispatcher",
  driver: "Driver",
  attendant: "Attendant",
  mechanic: "Mechanic",
  receptionist: "Receptionist",
  teacher: "Teacher",
  parent: "Parent",
  student: "Student",
  auditor: "Auditor",
  librarian: "Librarian",
  "assistant-librarian": "Assistant Librarian",
  "inventory-manager": "Inventory Manager",
  storekeeper: "Storekeeper",
  "department-head": "Department Head",
  "hr-manager": "HR Manager",
  "hr-executive": "HR Executive",
  recruiter: "Recruiter",
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
  | "payroll.manageLoans"
  // Phase 6 — transport and fleet operations
  | "transport.view"
  | "transport.manageRoutes"
  | "transport.manageStops"
  | "transport.manageVehicles"
  | "transport.manageDrivers"
  | "transport.manageAttendants"
  | "transport.assignStudents"
  | "transport.manageTrips"
  | "transport.viewLive"
  | "transport.markAttendance"
  | "transport.reportIncident"
  | "transport.manageIncidents"
  | "transport.manageMaintenance"
  | "transport.manageFuel"
  | "transport.manageDocuments"
  | "transport.manageFees"
  | "transport.viewReports"
  | "transport.manageNotifications"
  | "transport.manageSettings"
  | "transport.viewGpsHistory"
  | "transport.viewCosts"
  | "transport.driverAccess"
  | "transport.attendantAccess"
  | "transport.viewOwn"
  // Phase 7 — library
  | "library.view"
  | "library.manageCatalogue"
  | "library.circulate"
  | "library.manageMembers"
  | "library.manageReservations"
  | "library.manageFines"
  | "library.waiveFines"
  | "library.manageDigital"
  | "library.manageStocktake"
  | "library.manageBarcode"
  | "library.viewReports"
  | "library.manageSettings"
  | "library.viewOwn"
  // Phase 7 — inventory
  | "inventory.view"
  | "inventory.manageItems"
  | "inventory.receive"
  | "inventory.issue"
  | "inventory.transfer"
  | "inventory.adjust"
  | "inventory.manageProcurement"
  | "inventory.manageStocktake"
  | "inventory.viewReports"
  // Phase 7 — assets
  | "assets.view"
  | "assets.manageRegister"
  | "assets.assign"
  | "assets.manageMaintenance"
  | "assets.runDepreciation"
  | "assets.dispose"
  | "assets.approveDisposal"
  | "assets.viewReports"
  // Phase 8 — HR & people operations
  | "hr.view"
  | "hr.viewOwn"
  | "hr.manageStaff"
  | "hr.viewSensitive"
  | "hr.manageDepartments"
  | "hr.manageAttendance"
  | "hr.manageLeave"
  | "hr.approveLeave"
  | "hr.manageContracts"
  | "hr.manageDocuments"
  | "hr.manageRecruitment"
  | "hr.manageOnboarding"
  | "hr.managePerformance"
  | "hr.manageTraining"
  | "hr.manageLetters"
  | "hr.viewAnalytics";

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

// Transport permission groups — mirrors the Phase 5 FEES_*/ACCOUNTING_* shape.
// OPERATE = day-to-day dispatch/ops work; MANAGE adds routes/vehicles/drivers/
// settings (Transport Administrator only); OVERSIGHT is read-only visibility
// for principal/school-owner.
const TRANSPORT_OPERATE: Permission[] = [
  "transport.view",
  "transport.manageTrips",
  "transport.viewLive",
  "transport.markAttendance",
  "transport.reportIncident",
  "transport.manageIncidents",
  "transport.manageMaintenance",
  "transport.manageFuel",
  "transport.viewReports",
  "transport.viewGpsHistory",
];
const TRANSPORT_MANAGE: Permission[] = [...TRANSPORT_OPERATE, "transport.manageRoutes", "transport.manageStops", "transport.manageVehicles", "transport.manageDrivers", "transport.manageAttendants", "transport.assignStudents", "transport.manageDocuments", "transport.manageFees", "transport.manageNotifications", "transport.manageSettings", "transport.viewCosts"];
const TRANSPORT_OVERSIGHT: Permission[] = ["transport.view", "transport.viewReports", "transport.viewLive", "transport.viewGpsHistory"];

// Phase 7 permission groups — library, inventory, assets. Same compose-from-
// group shape as the Phase 5/6 finance and transport matrices above.
const LIBRARY_CIRCULATE: Permission[] = ["library.view", "library.circulate", "library.manageMembers", "library.manageReservations", "library.manageFines", "library.manageBarcode", "library.viewReports"];
const LIBRARY_MANAGE: Permission[] = [...LIBRARY_CIRCULATE, "library.manageCatalogue", "library.waiveFines", "library.manageDigital", "library.manageStocktake", "library.manageSettings"];
const LIBRARY_OVERSIGHT: Permission[] = ["library.view", "library.viewReports"];

const INVENTORY_OPERATE: Permission[] = ["inventory.view", "inventory.receive", "inventory.issue", "inventory.transfer", "inventory.manageStocktake", "inventory.viewReports"];
const INVENTORY_MANAGE: Permission[] = [...INVENTORY_OPERATE, "inventory.manageItems", "inventory.adjust", "inventory.manageProcurement"];
const INVENTORY_OVERSIGHT: Permission[] = ["inventory.view", "inventory.viewReports"];

const ASSETS_MANAGE: Permission[] = ["assets.view", "assets.manageRegister", "assets.assign", "assets.manageMaintenance", "assets.runDepreciation", "assets.dispose", "assets.viewReports"];
const ASSETS_OVERSIGHT: Permission[] = ["assets.view", "assets.viewReports", "assets.approveDisposal"];

// Phase 8 HR permission groups — same compose-from-group shape as prior phases.
const HR_ALL: Permission[] = [
  "hr.view",
  "hr.manageStaff",
  "hr.viewSensitive",
  "hr.manageDepartments",
  "hr.manageAttendance",
  "hr.manageLeave",
  "hr.approveLeave",
  "hr.manageContracts",
  "hr.manageDocuments",
  "hr.manageRecruitment",
  "hr.manageOnboarding",
  "hr.managePerformance",
  "hr.manageTraining",
  "hr.manageLetters",
  "hr.viewAnalytics",
];
const HR_OPERATE: Permission[] = ["hr.view", "hr.manageStaff", "hr.manageAttendance", "hr.manageLeave", "hr.manageDocuments", "hr.manageOnboarding", "hr.manageTraining", "hr.viewAnalytics"];
const HR_OVERSIGHT: Permission[] = ["hr.view", "hr.approveLeave", "hr.viewAnalytics"];

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
    ...TRANSPORT_MANAGE,
    ...LIBRARY_MANAGE,
    ...INVENTORY_MANAGE,
    ...ASSETS_MANAGE,
    "assets.approveDisposal",
    ...HR_ALL,
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
    ...TRANSPORT_OVERSIGHT,
    ...LIBRARY_OVERSIGHT,
    ...INVENTORY_OVERSIGHT,
    ...ASSETS_OVERSIGHT,
    ...HR_OVERSIGHT,
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
    ...TRANSPORT_OVERSIGHT,
    ...LIBRARY_OVERSIGHT,
    "library.waiveFines",
    ...INVENTORY_OVERSIGHT,
    ...ASSETS_OVERSIGHT,
    ...HR_OVERSIGHT,
    "hr.viewSensitive",
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
    "transport.view",
    "transport.manageFees",
    "transport.viewCosts",
    "transport.viewReports",
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
    "transport.view",
    "transport.viewReports",
    "transport.viewGpsHistory",
    "library.view",
    "library.viewReports",
    "inventory.view",
    "inventory.viewReports",
    "assets.view",
    "assets.viewReports",
    "hr.view",
    "hr.viewAnalytics",
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
    ...HR_OPERATE,
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
    "library.view",
    "library.viewOwn",
    "hr.viewOwn",
  ],
  accountant: ["students.view", "parents.view", "finance.viewDashboard", "payroll.view", "payroll.viewPayslips", "accounting.postJournals", ...FEES_OPERATE, ...ACCOUNTING_OPERATE, "transport.view", "transport.manageFees", "transport.viewCosts", "transport.viewReports", "library.view", "library.manageFines", "library.viewReports", "inventory.view", "inventory.manageProcurement", "inventory.viewReports", "assets.view", "assets.runDepreciation", "assets.approveDisposal", "assets.viewReports", "hr.view", "hr.viewAnalytics"],
  "transport-administrator": ["students.view", "parents.view", "communication.send", ...TRANSPORT_MANAGE],
  "transport-manager": ["students.view", "parents.view", "communication.send", ...TRANSPORT_OPERATE, "transport.viewCosts"],
  dispatcher: ["students.view", "transport.view", "transport.viewLive", "transport.manageTrips", "transport.markAttendance", "transport.reportIncident", "transport.viewGpsHistory"],
  driver: ["transport.driverAccess", "transport.reportIncident"],
  attendant: ["transport.attendantAccess", "transport.markAttendance", "transport.reportIncident"],
  mechanic: ["transport.view", "transport.manageMaintenance", "transport.manageFuel", "transport.manageDocuments", "transport.viewCosts"],
  receptionist: ["students.view", "parents.view", "communication.send", "transport.view", "transport.viewLive"],
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
    "transport.viewOwn",
    "library.viewOwn",
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
    "transport.viewOwn",
    "library.viewOwn",
  ],
  // Phase 7 — library, inventory and asset operations roles
  librarian: ["students.view", "parents.view", "communication.send", ...LIBRARY_MANAGE],
  "assistant-librarian": ["students.view", ...LIBRARY_CIRCULATE],
  "inventory-manager": ["communication.send", ...INVENTORY_MANAGE, "assets.view", "assets.viewReports"],
  storekeeper: ["inventory.view", "inventory.receive", "inventory.issue", "inventory.manageStocktake"],
  "department-head": ["students.view", "library.view", "inventory.view", "assets.view", "assets.assign", "assets.viewReports", "assets.approveDisposal", "hr.view", "hr.approveLeave", "hr.managePerformance", "hr.viewAnalytics"],
  "hr-manager": ["students.view", "communication.send", "payroll.view", "payroll.viewPayslips", ...HR_ALL],
  "hr-executive": ["students.view", "communication.send", ...HR_OPERATE],
  recruiter: ["hr.view", "hr.manageRecruitment"],
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
  "transport-administrator",
  "transport-manager",
  "dispatcher",
  "driver",
  "attendant",
  "mechanic",
  "receptionist",
  "teacher",
  "parent",
  "student",
  "auditor",
  "librarian",
  "assistant-librarian",
  "inventory-manager",
  "storekeeper",
  "department-head",
  "hr-manager",
  "hr-executive",
  "recruiter",
];
