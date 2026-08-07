import type { AdmissionApplication } from "@/lib/types/admissions";
import type { Guardian, ParentAccount, Student, StudentGuardianLink } from "@/lib/types/students";
import type { ImportJob } from "@/lib/types/import";
import type { SavedView } from "@/lib/types/views";
import type {
  AcademicEvent,
  CurriculumUnit,
  Homework,
  HomeworkSubmission,
  LessonPlan,
  ManagedClass,
  Room,
  StudentSupportAlert,
  Subject,
  SubjectAssignment,
  Teacher,
} from "@/lib/types/academics";
import type { AttendanceRule, AttendanceSession, LeaveRequest, StaffAttendance } from "@/lib/types/attendance";
import type { DismissedConflict, Timetable } from "@/lib/types/timetable";
import type { DismissedExamConflict, Exam, ExamAttendanceRecord, ExamAuditEntry, ExamClass, ExamSubject } from "@/lib/types/exams";
import type { GradingScheme, ResultRule } from "@/lib/types/grading";
import type { MarksEntrySession, MarksVerification, StudentMark } from "@/lib/types/marks";
import type { ReportCard, ReportCardGenerationJob, ReportCardTemplate, TeacherRemark } from "@/lib/types/report-cards";
import type { ResultPublication, ResultVersion, StudentResult } from "@/lib/types/results";
import type { PromotionRule, PromotionRun } from "@/lib/types/promotion";
import type {
  Concession,
  Discount,
  FeeCategory,
  FeeRule,
  FeeStructure,
  LateFeeRule,
  ReminderLog,
  ReminderRule,
  Scholarship,
  StudentFeeAssignment,
  StudentFeeItem,
} from "@/lib/types/fees";
import type {
  BankTransaction,
  CreditBalance,
  Invoice,
  Payment,
  PaymentAllocation,
  PaymentLink,
  ReconciliationRecord,
  Receipt,
  Refund,
} from "@/lib/types/payments";
import type {
  BankAccount,
  Budget,
  CashAccount,
  CashierShift,
  ChartOfAccount,
  Expense,
  Income,
  JournalEntry,
  LedgerEntry,
  PurchaseOrder,
  Vendor,
} from "@/lib/types/accounting";
import type { EmployeeAdvance, EmployeeLoan, PayrollRun, Payslip, SalaryStructure } from "@/lib/types/payroll";
import type { FinancialAuditEvent } from "@/lib/types/finance-audit";
import type {
  Attendant,
  Driver,
  DriverAvailability,
  DriverDocument,
  DriverTraining,
  DropRecord,
  FuelRecord,
  MaintenanceRecord,
  PickupRecord,
  RouteStop,
  StaffTransportAssignment,
  StudentTransportAssignment,
  TransportAttendance,
  TransportFeeCharge,
  TransportFeeRule,
  TransportIncident,
  TransportNotification,
  TransportNotificationRule,
  TransportRoute,
  TransportShiftPolicy,
  TransportStop,
  TransportTrip,
  TripStop,
  TripStudent,
  Vehicle,
  VehicleAssignment,
  VehicleDocument,
  VehicleSeat,
} from "@/lib/types/transport";
import type { GPSDevice, GPSPosition, RouteDeviation } from "@/lib/types/gps";
import type { TransportAuditEvent } from "@/lib/types/transport-audit";
import type {
  Author,
  Book,
  BookCategory,
  BookCopy,
  DigitalResource,
  DigitalResourceAccess,
  Library,
  LibraryFine,
  LibraryLoan,
  LibraryMember,
  LibraryReservation,
  LibraryRule,
  LibraryStocktake,
  LibraryStocktakeItem,
  Publisher,
  Shelf,
  ShelfLocation,
} from "@/lib/types/library";
import type { ResourceAuditEvent } from "@/lib/types/resource-audit";
import type {
  InventoryCategory,
  InventoryIssue,
  InventoryItem,
  InventoryMovement,
  InventoryPurchaseRequest,
  InventoryReturn,
  InventoryStocktake,
  InventoryStocktakeLine,
  InventoryTransfer,
} from "@/lib/types/inventory";
import type { Asset, AssetAssignment, AssetCategory, AssetDepreciation, AssetDisposal, AssetMaintenance } from "@/lib/types/assets";
import type {
  Announcement,
  Broadcast,
  CommNotification,
  CommunicationGroup,
  CommunicationTemplate,
  Conversation,
  ConversationParticipant,
  Delivery,
  FrontDeskIncident,
  GatePass,
  HelpdeskTicket,
  KnowledgeArticle,
  Message,
  Notice,
  NotificationSettings,
  ReceptionCall,
  ScheduledCommunication,
  TicketReply,
  Visitor,
  VisitorAppointment,
} from "@/lib/types/communication";
import type {
  Candidate,
  Contract,
  Department,
  Designation,
  Employee,
  EmployeeAssetLink,
  EmployeeTimelineEvent,
  Feedback,
  HrAnnouncement,
  HrAttendanceRecord,
  HrLeaveRequest,
  HrPolicy,
  Interview,
  LeaveBalance,
  OffboardingCase,
  OnboardingTask,
  PerformanceCycle,
  PerformanceGoal,
  PerformanceReview,
  RecruitmentJob,
  Shift,
  StaffDocument,
  StaffLetter,
  TrainingCourse,
  TrainingEnrollment,
} from "@/lib/types/hr";
import { buildLedgerFromJournal } from "@/lib/selectors/ledger";
import {
  bankAccounts,
  buildFeeStructures,
  buildLoansAndAdvances,
  buildPayrollForJuly,
  buildSalaryStructures,
  budgets,
  cashAccounts,
  chartOfAccounts,
  expenseJournals,
  expenses,
  feeCategories,
  generateBankTransactions,
  generateFinanceData,
  lateFeeRules,
  purchaseOrders,
  reminderRules,
  vendors,
} from "./seed/finance";
import { generateAdmissionApplications } from "./seed/admissions";
import { generateStudents } from "./seed/students";
import {
  academicEvents,
  curriculumUnits,
  generateHomeworkSubmissions,
  generateStudentSupportAlerts,
  homeworkList,
  lessonPlans,
  managedClasses,
  rooms,
  subjectAssignments,
  subjects,
  teachers,
} from "./seed/academics";
import { attendanceRules, generateAttendanceSessions, leaveRequests, staffAttendanceToday } from "./seed/attendance";
import { timetables } from "./seed/timetable";
import { examClasses, examSubjects, exams, generateExamStudentData, gradingSchemes, reportCardTemplates, resultRules } from "./seed/exams";
import {
  attendants,
  driverDocuments,
  driverTraining,
  drivers,
  generateTransportData,
  gpsDevices,
  routeStops,
  transportRoutes,
  transportStops,
  vehicleAssignments,
  vehicleDocuments,
  vehicleSeats,
  vehicles,
} from "./seed/transport";
import {
  authors,
  bookCategories,
  books,
  buildLibraryData,
  digitalResources,
  libraries,
  libraryRules,
  publishers,
  shelfLocations,
  shelves,
} from "./seed/library";
import { inventoryCategories, inventoryIssues, inventoryItems, inventoryMovements } from "./seed/inventory";
import { assetAssignments, assetCategories, assetMaintenance, assets } from "./seed/assets";
import { buildHrData, departments, designations, shifts } from "./seed/hr";
import { buildCommunicationData } from "./seed/communication";

export type Db = {
  applications: AdmissionApplication[];
  students: Student[];
  guardians: Guardian[];
  studentGuardianLinks: StudentGuardianLink[];
  parentAccounts: ParentAccount[];
  importJobs: ImportJob[];
  savedViews: SavedView[];
  classes: ManagedClass[];
  teachers: Teacher[];
  rooms: Room[];
  subjects: Subject[];
  subjectAssignments: SubjectAssignment[];
  curriculumUnits: CurriculumUnit[];
  lessonPlans: LessonPlan[];
  homework: Homework[];
  homeworkSubmissions: HomeworkSubmission[];
  academicEvents: AcademicEvent[];
  studentSupportAlerts: StudentSupportAlert[];
  attendanceSessions: AttendanceSession[];
  attendanceRules: AttendanceRule[];
  leaveRequests: LeaveRequest[];
  staffAttendance: StaffAttendance[];
  timetables: Timetable[];
  dismissedConflicts: DismissedConflict[];
  // Phase 4 — examinations, marks, results, report cards, promotion
  exams: Exam[];
  examClasses: ExamClass[];
  examSubjects: ExamSubject[];
  dismissedExamConflicts: DismissedExamConflict[];
  examAttendance: ExamAttendanceRecord[];
  studentMarks: StudentMark[];
  marksEntrySessions: MarksEntrySession[];
  marksVerifications: MarksVerification[];
  gradingSchemes: GradingScheme[];
  resultRules: ResultRule[];
  examResults: StudentResult[];
  resultVersions: ResultVersion[];
  resultPublications: ResultPublication[];
  reportCardTemplates: ReportCardTemplate[];
  reportCards: ReportCard[];
  reportCardGenerationJobs: ReportCardGenerationJob[];
  teacherRemarks: TeacherRemark[];
  promotionRules: PromotionRule[];
  promotionRuns: PromotionRun[];
  examAuditLog: ExamAuditEntry[];
  // Phase 5 — fees, accounting and payroll
  feeCategories: FeeCategory[];
  feeStructures: FeeStructure[];
  feeRules: FeeRule[];
  studentFeeAssignments: StudentFeeAssignment[];
  studentFeeItems: StudentFeeItem[];
  discounts: Discount[];
  concessions: Concession[];
  scholarships: Scholarship[];
  lateFeeRules: LateFeeRule[];
  reminderRules: ReminderRule[];
  reminderLog: ReminderLog[];
  invoices: Invoice[];
  payments: Payment[];
  paymentAllocations: PaymentAllocation[];
  paymentLinks: PaymentLink[];
  receipts: Receipt[];
  refunds: Refund[];
  creditBalances: CreditBalance[];
  bankTransactions: BankTransaction[];
  reconciliationRecords: ReconciliationRecord[];
  incomes: Income[];
  expenses: Expense[];
  vendors: Vendor[];
  purchaseOrders: PurchaseOrder[];
  chartOfAccounts: ChartOfAccount[];
  journalEntries: JournalEntry[];
  ledgerEntries: LedgerEntry[];
  bankAccounts: BankAccount[];
  cashAccounts: CashAccount[];
  cashierShifts: CashierShift[];
  budgets: Budget[];
  salaryStructures: SalaryStructure[];
  payrollRuns: PayrollRun[];
  payslips: Payslip[];
  employeeLoans: EmployeeLoan[];
  employeeAdvances: EmployeeAdvance[];
  financialAuditLog: FinancialAuditEvent[];
  // Phase 6 — transport and fleet operations
  transportShiftPolicies: TransportShiftPolicy[];
  transportStops: TransportStop[];
  transportRoutes: TransportRoute[];
  routeStops: RouteStop[];
  vehicles: Vehicle[];
  vehicleSeats: VehicleSeat[];
  vehicleDocuments: VehicleDocument[];
  vehicleAssignments: VehicleAssignment[];
  drivers: Driver[];
  driverDocuments: DriverDocument[];
  driverTraining: DriverTraining[];
  driverAvailability: DriverAvailability[];
  attendants: Attendant[];
  studentTransportAssignments: StudentTransportAssignment[];
  staffTransportAssignments: StaffTransportAssignment[];
  transportTrips: TransportTrip[];
  tripStops: TripStop[];
  tripStudents: TripStudent[];
  pickupRecords: PickupRecord[];
  dropRecords: DropRecord[];
  transportAttendance: TransportAttendance[];
  gpsDevices: GPSDevice[];
  gpsPositions: GPSPosition[];
  routeDeviations: RouteDeviation[];
  transportIncidents: TransportIncident[];
  maintenanceRecords: MaintenanceRecord[];
  fuelRecords: FuelRecord[];
  transportNotificationRules: TransportNotificationRule[];
  transportNotifications: TransportNotification[];
  transportFeeRules: TransportFeeRule[];
  transportFeeCharges: TransportFeeCharge[];
  transportAuditLog: TransportAuditEvent[];
  // Phase 7 — library, digital resources, inventory and asset operations
  libraries: Library[];
  shelfLocations: ShelfLocation[];
  shelves: Shelf[];
  authors: Author[];
  publishers: Publisher[];
  bookCategories: BookCategory[];
  books: Book[];
  bookCopies: BookCopy[];
  libraryMembers: LibraryMember[];
  libraryRules: LibraryRule[];
  libraryLoans: LibraryLoan[];
  libraryReservations: LibraryReservation[];
  libraryFines: LibraryFine[];
  digitalResources: DigitalResource[];
  digitalResourceAccess: DigitalResourceAccess[];
  libraryStocktakes: LibraryStocktake[];
  libraryStocktakeItems: LibraryStocktakeItem[];
  // Inventory
  inventoryCategories: InventoryCategory[];
  inventoryItems: InventoryItem[];
  inventoryMovements: InventoryMovement[];
  inventoryIssues: InventoryIssue[];
  inventoryReturns: InventoryReturn[];
  inventoryTransfers: InventoryTransfer[];
  inventoryPurchaseRequests: InventoryPurchaseRequest[];
  inventoryStocktakes: InventoryStocktake[];
  inventoryStocktakeLines: InventoryStocktakeLine[];
  // Assets
  assetCategories: AssetCategory[];
  assets: Asset[];
  assetAssignments: AssetAssignment[];
  assetMaintenance: AssetMaintenance[];
  assetDepreciation: AssetDepreciation[];
  assetDisposals: AssetDisposal[];
  resourceAuditLog: ResourceAuditEvent[];
  // Phase 8 — HR & people operations (frontend mock state)
  departments: Department[];
  designations: Designation[];
  shifts: Shift[];
  employees: Employee[];
  contracts: Contract[];
  staffDocuments: StaffDocument[];
  hrAttendance: HrAttendanceRecord[];
  leaveBalances: LeaveBalance[];
  hrLeaveRequests: HrLeaveRequest[];
  recruitmentJobs: RecruitmentJob[];
  candidates: Candidate[];
  interviews: Interview[];
  onboardingTasks: OnboardingTask[];
  offboardingCases: OffboardingCase[];
  performanceCycles: PerformanceCycle[];
  performanceReviews: PerformanceReview[];
  performanceGoals: PerformanceGoal[];
  hrFeedback: Feedback[];
  trainingCourses: TrainingCourse[];
  trainingEnrollments: TrainingEnrollment[];
  employeeAssets: EmployeeAssetLink[];
  employeeTimeline: EmployeeTimelineEvent[];
  staffLetters: StaffLetter[];
  hrAnnouncements: HrAnnouncement[];
  hrPolicies: HrPolicy[];
  // Phase 9 — communication, notifications, helpdesk, front desk (frontend mock)
  conversations: Conversation[];
  conversationParticipants: ConversationParticipant[];
  messages: Message[];
  commGroups: CommunicationGroup[];
  commAnnouncements: Announcement[];
  commNotices: Notice[];
  commBroadcasts: Broadcast[];
  scheduledCommunications: ScheduledCommunication[];
  commTemplates: CommunicationTemplate[];
  commNotifications: CommNotification[];
  notificationSettings: NotificationSettings;
  helpdeskTickets: HelpdeskTicket[];
  ticketReplies: TicketReply[];
  knowledgeArticles: KnowledgeArticle[];
  visitors: Visitor[];
  visitorAppointments: VisitorAppointment[];
  gatePasses: GatePass[];
  receptionCalls: ReceptionCall[];
  deliveries: Delivery[];
  frontDeskIncidents: FrontDeskIncident[];
};

const STORAGE_KEY = "novyra-sis-store-v2";

const DEFAULT_SHIFT_POLICIES: TransportShiftPolicy[] = [
  { shift: "morning", defaultPickupTime: "07:00", defaultDropTime: "15:30" },
  { shift: "afternoon", defaultPickupTime: "12:00", defaultDropTime: "18:00" },
  { shift: "evening", defaultPickupTime: "16:00", defaultDropTime: "20:00" },
  { shift: "both", defaultPickupTime: "07:00", defaultDropTime: "15:30" },
];

function buildSeedDb(): Db {
  const applications = generateAdmissionApplications();
  const { students, guardians, studentGuardianLinks, parentAccounts } = generateStudents();
  const homeworkSubmissions = generateHomeworkSubmissions(students, homeworkList);
  const studentSupportAlerts = generateStudentSupportAlerts(students);
  const attendanceSessions = generateAttendanceSessions(students);
  const examStudentData = generateExamStudentData(students);

  const feeStructures = buildFeeStructures(managedClasses);
  const financeData = generateFinanceData(students, feeStructures);
  const salaryStructures = buildSalaryStructures(teachers);
  const julyPayroll = buildPayrollForJuly(salaryStructures, teachers);
  const { loans: employeeLoans, advances: employeeAdvances } = buildLoansAndAdvances(teachers);
  const allJournalEntries = [...financeData.journalEntries, ...expenseJournals(), julyPayroll.journal];
  const transportData = generateTransportData(students, teachers);
  const libraryData = buildLibraryData(students, teachers);
  const hrData = buildHrData(teachers);
  const commData = buildCommunicationData(students, teachers);
  const studentsWithTransport = students.map((s) => {
    const summary = transportData.studentSummaries.get(s.id);
    return summary ? { ...s, transport: summary } : s;
  });

  return {
    applications,
    students: studentsWithTransport,
    guardians,
    studentGuardianLinks,
    parentAccounts,
    importJobs: [],
    savedViews: [],
    classes: structuredClone(managedClasses),
    teachers,
    rooms,
    subjects,
    subjectAssignments,
    curriculumUnits,
    lessonPlans,
    homework: homeworkList,
    homeworkSubmissions,
    academicEvents,
    studentSupportAlerts,
    attendanceSessions,
    attendanceRules,
    leaveRequests,
    staffAttendance: staffAttendanceToday,
    timetables,
    dismissedConflicts: [],
    exams,
    examClasses,
    examSubjects,
    dismissedExamConflicts: [],
    examAttendance: examStudentData.examAttendance,
    studentMarks: examStudentData.studentMarks,
    marksEntrySessions: examStudentData.marksEntrySessions,
    marksVerifications: examStudentData.marksVerifications,
    gradingSchemes,
    resultRules,
    examResults: examStudentData.studentResults,
    resultVersions: examStudentData.resultVersions,
    resultPublications: examStudentData.resultPublications,
    reportCardTemplates,
    reportCards: examStudentData.reportCards,
    reportCardGenerationJobs: [],
    teacherRemarks: examStudentData.teacherRemarks,
    promotionRules: [],
    promotionRuns: [],
    examAuditLog: [],
    feeCategories,
    feeStructures,
    feeRules: [],
    studentFeeAssignments: financeData.studentFeeAssignments,
    studentFeeItems: financeData.studentFeeItems,
    discounts: financeData.discounts,
    concessions: financeData.concessions,
    scholarships: financeData.scholarships,
    lateFeeRules,
    reminderRules,
    reminderLog: [],
    invoices: [],
    payments: financeData.payments,
    paymentAllocations: financeData.paymentAllocations,
    paymentLinks: [],
    receipts: financeData.receipts,
    refunds: [],
    creditBalances: [],
    bankTransactions: generateBankTransactions(financeData.payments),
    reconciliationRecords: [],
    incomes: [],
    expenses,
    vendors,
    purchaseOrders,
    chartOfAccounts,
    journalEntries: allJournalEntries,
    ledgerEntries: buildLedgerFromJournal(allJournalEntries),
    bankAccounts,
    cashAccounts,
    cashierShifts: [],
    budgets,
    salaryStructures,
    payrollRuns: [julyPayroll.run],
    payslips: julyPayroll.payslips,
    employeeLoans,
    employeeAdvances,
    financialAuditLog: [],
    transportShiftPolicies: structuredClone(DEFAULT_SHIFT_POLICIES),
    transportStops: structuredClone(transportStops),
    transportRoutes: structuredClone(transportRoutes),
    routeStops: structuredClone(routeStops),
    vehicles: structuredClone(vehicles),
    vehicleSeats: transportData.vehicleSeats,
    vehicleDocuments: structuredClone(vehicleDocuments),
    vehicleAssignments: structuredClone(vehicleAssignments),
    drivers: structuredClone(drivers),
    driverDocuments: structuredClone(driverDocuments),
    driverTraining: structuredClone(driverTraining),
    driverAvailability: [],
    attendants: structuredClone(attendants),
    studentTransportAssignments: transportData.studentAssignments,
    staffTransportAssignments: transportData.staffAssignments,
    transportTrips: transportData.trips,
    tripStops: transportData.tripStops,
    tripStudents: transportData.tripStudents,
    pickupRecords: transportData.pickupRecords,
    dropRecords: transportData.dropRecords,
    transportAttendance: transportData.transportAttendance,
    gpsDevices: structuredClone(gpsDevices),
    gpsPositions: transportData.gpsPositions,
    routeDeviations: transportData.routeDeviations,
    transportIncidents: transportData.incidents,
    maintenanceRecords: transportData.maintenanceRecords,
    fuelRecords: transportData.fuelRecords,
    transportNotificationRules: transportData.notificationRules,
    transportNotifications: transportData.notifications,
    transportFeeRules: transportData.feeRules,
    transportFeeCharges: transportData.feeCharges,
    transportAuditLog: [],
    libraries: structuredClone(libraryData.libraries),
    shelfLocations: structuredClone(shelfLocations),
    shelves: structuredClone(shelves),
    authors: structuredClone(authors),
    publishers: structuredClone(publishers),
    bookCategories: structuredClone(bookCategories),
    books: structuredClone(books),
    bookCopies: libraryData.copies,
    libraryMembers: libraryData.members,
    libraryRules: structuredClone(libraryRules),
    libraryLoans: libraryData.loans,
    libraryReservations: libraryData.reservations,
    libraryFines: libraryData.fines,
    digitalResources: structuredClone(digitalResources),
    digitalResourceAccess: [],
    libraryStocktakes: [],
    libraryStocktakeItems: [],
    inventoryCategories: structuredClone(inventoryCategories),
    inventoryItems: structuredClone(inventoryItems),
    inventoryMovements: structuredClone(inventoryMovements),
    inventoryIssues: structuredClone(inventoryIssues),
    inventoryReturns: [],
    inventoryTransfers: [],
    inventoryPurchaseRequests: [],
    inventoryStocktakes: [],
    inventoryStocktakeLines: [],
    assetCategories: structuredClone(assetCategories),
    assets: structuredClone(assets),
    assetAssignments: structuredClone(assetAssignments),
    assetMaintenance: structuredClone(assetMaintenance),
    assetDepreciation: [],
    assetDisposals: [],
    resourceAuditLog: [],
    departments: structuredClone(departments),
    designations: structuredClone(designations),
    shifts: structuredClone(shifts),
    employees: hrData.employees,
    contracts: hrData.contracts,
    staffDocuments: hrData.documents,
    hrAttendance: hrData.attendance,
    leaveBalances: hrData.leaveBalances,
    hrLeaveRequests: hrData.leaveRequests,
    recruitmentJobs: hrData.jobs,
    candidates: hrData.candidates,
    interviews: hrData.interviews,
    onboardingTasks: hrData.onboardingTasks,
    offboardingCases: hrData.offboarding,
    performanceCycles: hrData.cycles,
    performanceReviews: hrData.reviews,
    performanceGoals: hrData.goals,
    hrFeedback: hrData.feedback,
    trainingCourses: hrData.courses,
    trainingEnrollments: hrData.enrollments,
    employeeAssets: hrData.assetLinks,
    employeeTimeline: hrData.timelines,
    staffLetters: hrData.letters,
    hrAnnouncements: hrData.announcements,
    hrPolicies: hrData.policies,
    conversations: commData.conversations,
    conversationParticipants: commData.participants,
    messages: commData.messages,
    commGroups: commData.groups,
    commAnnouncements: commData.announcements,
    commNotices: commData.notices,
    commBroadcasts: commData.broadcasts,
    scheduledCommunications: commData.scheduled,
    commTemplates: commData.templates,
    commNotifications: commData.notifications,
    notificationSettings: commData.notificationSettings,
    helpdeskTickets: commData.tickets,
    ticketReplies: commData.replies,
    knowledgeArticles: commData.knowledge,
    visitors: commData.visitors,
    visitorAppointments: commData.appointments,
    gatePasses: commData.gatePasses,
    receptionCalls: commData.calls,
    deliveries: commData.deliveries,
    frontDeskIncidents: commData.incidents,
  };
}

// Seeded deterministically so the very first server-rendered HTML and the
// client's pre-hydration render are byte-identical — localStorage (which can
// differ from the seed) is only applied afterwards, via hydrateFromStorage(),
// so it lands as a normal post-mount state update rather than a hydration
// mismatch.
let state: Db = buildSeedDb();
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable (private browsing) — in-memory state still works for this session.
  }
}

export function getSnapshot(): Db {
  return state;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function hydrateFromStorage() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Db;
    if (parsed && Array.isArray(parsed.applications) && Array.isArray(parsed.students) && Array.isArray(parsed.classes)) {
      // Older cached snapshots predate the conflict-dismissal feature and the whole Phase 4
      // exams domain — backfill missing fields rather than force a full reseed.
      state = {
        ...parsed,
        dismissedConflicts: parsed.dismissedConflicts ?? [],
        exams: parsed.exams ?? exams,
        examClasses: parsed.examClasses ?? examClasses,
        examSubjects: parsed.examSubjects ?? examSubjects,
        dismissedExamConflicts: parsed.dismissedExamConflicts ?? [],
        examAttendance: parsed.examAttendance ?? [],
        studentMarks: parsed.studentMarks ?? [],
        marksEntrySessions: parsed.marksEntrySessions ?? [],
        marksVerifications: parsed.marksVerifications ?? [],
        gradingSchemes: parsed.gradingSchemes ?? gradingSchemes,
        resultRules: parsed.resultRules ?? resultRules,
        examResults: parsed.examResults ?? [],
        resultVersions: parsed.resultVersions ?? [],
        resultPublications: parsed.resultPublications ?? [],
        reportCardTemplates: parsed.reportCardTemplates ?? reportCardTemplates,
        reportCards: parsed.reportCards ?? [],
        reportCardGenerationJobs: parsed.reportCardGenerationJobs ?? [],
        teacherRemarks: parsed.teacherRemarks ?? [],
        promotionRules: parsed.promotionRules ?? [],
        promotionRuns: parsed.promotionRuns ?? [],
        examAuditLog: parsed.examAuditLog ?? [],
        // Older cached snapshots predate the whole Phase 5 finance domain —
        // static config-like lists fall back to the fresh seed constant,
        // everything transactional falls back to empty rather than
        // reseeding a parallel data set into an otherwise-modified snapshot.
        feeCategories: parsed.feeCategories ?? feeCategories,
        feeStructures: parsed.feeStructures ?? [],
        feeRules: parsed.feeRules ?? [],
        studentFeeAssignments: parsed.studentFeeAssignments ?? [],
        studentFeeItems: parsed.studentFeeItems ?? [],
        discounts: parsed.discounts ?? [],
        concessions: parsed.concessions ?? [],
        scholarships: parsed.scholarships ?? [],
        lateFeeRules: parsed.lateFeeRules ?? lateFeeRules,
        reminderRules: parsed.reminderRules ?? reminderRules,
        reminderLog: parsed.reminderLog ?? [],
        invoices: parsed.invoices ?? [],
        payments: parsed.payments ?? [],
        paymentAllocations: parsed.paymentAllocations ?? [],
        paymentLinks: parsed.paymentLinks ?? [],
        receipts: parsed.receipts ?? [],
        refunds: parsed.refunds ?? [],
        creditBalances: parsed.creditBalances ?? [],
        bankTransactions: parsed.bankTransactions ?? [],
        reconciliationRecords: parsed.reconciliationRecords ?? [],
        incomes: parsed.incomes ?? [],
        expenses: parsed.expenses ?? [],
        vendors: parsed.vendors ?? vendors,
        purchaseOrders: parsed.purchaseOrders ?? [],
        chartOfAccounts: parsed.chartOfAccounts ?? chartOfAccounts,
        journalEntries: parsed.journalEntries ?? [],
        ledgerEntries: parsed.ledgerEntries ?? [],
        bankAccounts: parsed.bankAccounts ?? bankAccounts,
        cashAccounts: parsed.cashAccounts ?? cashAccounts,
        cashierShifts: parsed.cashierShifts ?? [],
        budgets: parsed.budgets ?? [],
        salaryStructures: parsed.salaryStructures ?? [],
        payrollRuns: parsed.payrollRuns ?? [],
        payslips: parsed.payslips ?? [],
        employeeLoans: parsed.employeeLoans ?? [],
        employeeAdvances: parsed.employeeAdvances ?? [],
        financialAuditLog: parsed.financialAuditLog ?? [],
        // Older cached snapshots predate the whole Phase 6 transport domain —
        // same fallback convention as Phase 5 above.
        transportShiftPolicies: parsed.transportShiftPolicies ?? DEFAULT_SHIFT_POLICIES,
        transportStops: parsed.transportStops ?? transportStops,
        transportRoutes: parsed.transportRoutes ?? transportRoutes,
        routeStops: parsed.routeStops ?? routeStops,
        vehicles: parsed.vehicles ?? vehicles,
        vehicleSeats: parsed.vehicleSeats ?? vehicleSeats,
        vehicleDocuments: parsed.vehicleDocuments ?? vehicleDocuments,
        vehicleAssignments: parsed.vehicleAssignments ?? vehicleAssignments,
        drivers: parsed.drivers ?? drivers,
        driverDocuments: parsed.driverDocuments ?? driverDocuments,
        driverTraining: parsed.driverTraining ?? driverTraining,
        driverAvailability: parsed.driverAvailability ?? [],
        attendants: parsed.attendants ?? attendants,
        studentTransportAssignments: parsed.studentTransportAssignments ?? [],
        staffTransportAssignments: parsed.staffTransportAssignments ?? [],
        transportTrips: parsed.transportTrips ?? [],
        tripStops: parsed.tripStops ?? [],
        tripStudents: parsed.tripStudents ?? [],
        pickupRecords: parsed.pickupRecords ?? [],
        dropRecords: parsed.dropRecords ?? [],
        transportAttendance: parsed.transportAttendance ?? [],
        gpsDevices: parsed.gpsDevices ?? gpsDevices,
        gpsPositions: parsed.gpsPositions ?? [],
        routeDeviations: parsed.routeDeviations ?? [],
        transportIncidents: parsed.transportIncidents ?? [],
        maintenanceRecords: parsed.maintenanceRecords ?? [],
        fuelRecords: parsed.fuelRecords ?? [],
        transportNotificationRules: parsed.transportNotificationRules ?? [],
        transportNotifications: parsed.transportNotifications ?? [],
        transportFeeRules: parsed.transportFeeRules ?? [],
        transportFeeCharges: parsed.transportFeeCharges ?? [],
        transportAuditLog: parsed.transportAuditLog ?? [],
        // Older cached snapshots predate the whole Phase 7 library domain —
        // config-like lists fall back to the fresh seed constant, everything
        // transactional falls back to empty rather than reseeding.
        libraries: parsed.libraries ?? libraries,
        shelfLocations: parsed.shelfLocations ?? shelfLocations,
        shelves: parsed.shelves ?? shelves,
        authors: parsed.authors ?? authors,
        publishers: parsed.publishers ?? publishers,
        bookCategories: parsed.bookCategories ?? bookCategories,
        books: parsed.books ?? books,
        bookCopies: parsed.bookCopies ?? [],
        libraryMembers: parsed.libraryMembers ?? [],
        libraryRules: parsed.libraryRules ?? libraryRules,
        libraryLoans: parsed.libraryLoans ?? [],
        libraryReservations: parsed.libraryReservations ?? [],
        libraryFines: parsed.libraryFines ?? [],
        digitalResources: parsed.digitalResources ?? digitalResources,
        digitalResourceAccess: parsed.digitalResourceAccess ?? [],
        libraryStocktakes: parsed.libraryStocktakes ?? [],
        libraryStocktakeItems: parsed.libraryStocktakeItems ?? [],
        inventoryCategories: parsed.inventoryCategories ?? inventoryCategories,
        inventoryItems: parsed.inventoryItems ?? inventoryItems,
        inventoryMovements: parsed.inventoryMovements ?? inventoryMovements,
        inventoryIssues: parsed.inventoryIssues ?? [],
        inventoryReturns: parsed.inventoryReturns ?? [],
        inventoryTransfers: parsed.inventoryTransfers ?? [],
        inventoryPurchaseRequests: parsed.inventoryPurchaseRequests ?? [],
        inventoryStocktakes: parsed.inventoryStocktakes ?? [],
        inventoryStocktakeLines: parsed.inventoryStocktakeLines ?? [],
        assetCategories: parsed.assetCategories ?? assetCategories,
        assets: parsed.assets ?? assets,
        assetAssignments: parsed.assetAssignments ?? [],
        assetMaintenance: parsed.assetMaintenance ?? [],
        assetDepreciation: parsed.assetDepreciation ?? [],
        assetDisposals: parsed.assetDisposals ?? [],
        resourceAuditLog: parsed.resourceAuditLog ?? [],
        // Phase 8 HR — legacy snapshots predate this domain; regenerate the
        // workforce from the (cached) teachers so the module has data, config
        // lists fall back to the fresh seed constants.
        ...(() => {
          if (parsed.employees) {
            return {
              departments: parsed.departments ?? departments,
              designations: parsed.designations ?? designations,
              shifts: parsed.shifts ?? shifts,
              employees: parsed.employees,
              contracts: parsed.contracts ?? [],
              staffDocuments: parsed.staffDocuments ?? [],
              hrAttendance: parsed.hrAttendance ?? [],
              leaveBalances: parsed.leaveBalances ?? [],
              hrLeaveRequests: parsed.hrLeaveRequests ?? [],
              recruitmentJobs: parsed.recruitmentJobs ?? [],
              candidates: parsed.candidates ?? [],
              interviews: parsed.interviews ?? [],
              onboardingTasks: parsed.onboardingTasks ?? [],
              offboardingCases: parsed.offboardingCases ?? [],
              performanceCycles: parsed.performanceCycles ?? [],
              performanceReviews: parsed.performanceReviews ?? [],
              performanceGoals: parsed.performanceGoals ?? [],
              hrFeedback: parsed.hrFeedback ?? [],
              trainingCourses: parsed.trainingCourses ?? [],
              trainingEnrollments: parsed.trainingEnrollments ?? [],
              employeeAssets: parsed.employeeAssets ?? [],
              employeeTimeline: parsed.employeeTimeline ?? [],
              staffLetters: parsed.staffLetters ?? [],
              hrAnnouncements: parsed.hrAnnouncements ?? [],
              hrPolicies: parsed.hrPolicies ?? [],
            };
          }
          const hr = buildHrData(parsed.teachers ?? teachers);
          return {
            departments,
            designations,
            shifts,
            employees: hr.employees,
            contracts: hr.contracts,
            staffDocuments: hr.documents,
            hrAttendance: hr.attendance,
            leaveBalances: hr.leaveBalances,
            hrLeaveRequests: hr.leaveRequests,
            recruitmentJobs: hr.jobs,
            candidates: hr.candidates,
            interviews: hr.interviews,
            onboardingTasks: hr.onboardingTasks,
            offboardingCases: hr.offboarding,
            performanceCycles: hr.cycles,
            performanceReviews: hr.reviews,
            performanceGoals: hr.goals,
            hrFeedback: hr.feedback,
            trainingCourses: hr.courses,
            trainingEnrollments: hr.enrollments,
            employeeAssets: hr.assetLinks,
            employeeTimeline: hr.timelines,
            staffLetters: hr.letters,
            hrAnnouncements: hr.announcements,
            hrPolicies: hr.policies,
          };
        })(),
        // Phase 9 communication — legacy snapshots predate this domain; regenerate
        // from the cached students/teachers so the module always has data.
        ...(() => {
          if (parsed.conversations && parsed.notificationSettings) {
            return {
              conversations: parsed.conversations,
              conversationParticipants: parsed.conversationParticipants ?? [],
              messages: parsed.messages ?? [],
              commGroups: parsed.commGroups ?? [],
              commAnnouncements: parsed.commAnnouncements ?? [],
              commNotices: parsed.commNotices ?? [],
              commBroadcasts: parsed.commBroadcasts ?? [],
              scheduledCommunications: parsed.scheduledCommunications ?? [],
              commTemplates: parsed.commTemplates ?? [],
              commNotifications: parsed.commNotifications ?? [],
              notificationSettings: parsed.notificationSettings,
              helpdeskTickets: parsed.helpdeskTickets ?? [],
              ticketReplies: parsed.ticketReplies ?? [],
              knowledgeArticles: parsed.knowledgeArticles ?? [],
              visitors: parsed.visitors ?? [],
              visitorAppointments: parsed.visitorAppointments ?? [],
              gatePasses: parsed.gatePasses ?? [],
              receptionCalls: parsed.receptionCalls ?? [],
              deliveries: parsed.deliveries ?? [],
              frontDeskIncidents: parsed.frontDeskIncidents ?? [],
            };
          }
          const c = buildCommunicationData(parsed.students ?? [], parsed.teachers ?? teachers);
          return {
            conversations: c.conversations,
            conversationParticipants: c.participants,
            messages: c.messages,
            commGroups: c.groups,
            commAnnouncements: c.announcements,
            commNotices: c.notices,
            commBroadcasts: c.broadcasts,
            scheduledCommunications: c.scheduled,
            commTemplates: c.templates,
            commNotifications: c.notifications,
            notificationSettings: c.notificationSettings,
            helpdeskTickets: c.tickets,
            ticketReplies: c.replies,
            knowledgeArticles: c.knowledge,
            visitors: c.visitors,
            visitorAppointments: c.appointments,
            gatePasses: c.gatePasses,
            receptionCalls: c.calls,
            deliveries: c.deliveries,
            frontDeskIncidents: c.incidents,
          };
        })(),
      };
      notify();
    }
  } catch {
    // Corrupt or incompatible snapshot — keep the freshly seeded in-memory state.
  }
}

export function resetDemoData() {
  state = buildSeedDb();
  persist();
  notify();
}

/** Applies an immutable update to the store and notifies + persists. Internal — services call this, UI never should. */
export function setState(updater: (draft: Db) => Db) {
  state = updater(state);
  persist();
  notify();
}
