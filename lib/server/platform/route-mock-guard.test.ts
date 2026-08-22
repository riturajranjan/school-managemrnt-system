// Migrated-route mock guard (Super Admin). These routes went real (PostgreSQL/
// API) and must never reintroduce a frontend-mock authority. If someone later
// imports the mock store / mock service / mock selectors / db.saas into one of
// these pages, this test fails. See docs/backend/mock-debt.md.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

// Directories whose page/component sources must be mock-free.
const MIGRATED_ROUTE_DIRS = [
  "app/super-admin/plans",
  "app/super-admin/subscriptions",
  "app/super-admin/trials",
  "app/super-admin/billing",
  "app/super-admin/invoices",
  "app/super-admin/payments",
  "app/super-admin/health",
  "app/super-admin/usage",
  "app/super-admin/support",
  "app/super-admin/features",
  "app/super-admin/domains",
  "app/super-admin/branding",
  "app/super-admin/addons",
  "app/super-admin/marketplace",
  "app/super-admin/settings",
  "app/super-admin/announcements",
  "app/super-admin/status",
  "app/super-admin/audit",
  "app/super-admin/activity",
  "app/super-admin/permissions",
  // Phase 9A — Main Dashboard widgets: real (Attendance, Today's Timetable,
  // Upcoming Exams — GET /api/dashboard) or honestly deferred (School Pulse,
  // AI Morning Brief, 3D Campus Overview, Action Inbox, Fee Collection, Staff
  // Availability, Transport Status, Exception Feed — DeferredWidget, no
  // fetch). components/dashboard/data/types.ts keeps some still-shared mock
  // types (e.g. PulseFactor, reused by other not-yet-migrated dashboards) —
  // harmless, it contains no mock-store imports itself.
  "components/dashboard",
];

// Individual migrated files (not whole directories) that must stay mock-free.
// The dashboard page still legitimately uses db.saas for not-yet-migrated tiles,
// but its Platform Pulse widget + usage meter are real — guard those components.
// The Super Admin layout + global search are fully real (server-side search).
const MIGRATED_FILES = [
  "components/super-admin/platform-pulse.tsx",
  "components/super-admin/usage-meter.tsx",
  "components/super-admin/global-search.tsx",
  "app/super-admin/layout.tsx",
  "app/super-admin/page.tsx", // dashboard — fully real (SA-4J)
  // Phase 6-pre — the migrated academics-foundation pages (real Class/Section/
  // Enrollment). The class DETAIL page ([classId]) intentionally stays on the
  // mock store (bound to still-mock Subjects/Teachers/Timetable/Homework/Exams),
  // so only these two files are guarded — not the whole app/academics dir.
  "app/academics/classes/page.tsx",
  "app/academics/sections/page.tsx",
  // Phase 6 — the real Subjects catalogue + Class↔Subject assignment surface,
  // fully backed by /api/academics/subjects + /api/academics/classes/[id]/
  // subjects (PostgreSQL). It must never reintroduce the mock subjects store/
  // service/hooks/seed. The class DETAIL page ([classId]) still composes the
  // mock Subjects/Teachers/Timetable/Homework/Exams tabs and is NOT migrated.
  "app/academics/subjects/page.tsx",
  // Phase 7B.2 — the real Timetable builder + view, fully backed by
  // /api/timetable/* (PostgreSQL). No mock timetable store/service/hooks/seed,
  // no client conflict engine. The academics DASHBOARD + class DETAIL stay mock.
  "app/academics/timetable/page.tsx",
  "app/academics/timetable/create/page.tsx",
  "components/academics/timetable/real-timetable-grid.tsx",
  // Phase 8A — the real Exams foundation (term/exam/class/schedule), fully
  // backed by /api/exams/* (PostgreSQL). No mock exam store/service/selectors/
  // seed. Students/Attendance/Results/Publish pages stay mock (Phase 8C+).
  "app/exams/page.tsx",
  "app/exams/new/page.tsx",
  "app/exams/[examId]/page.tsx",
  "app/exams/[examId]/subjects/page.tsx",
  "app/exams/[examId]/schedule/page.tsx",
  // Phase 8B — the real Marks entry (ExamMarkSheet/ExamMark), fully backed by
  // /api/exams/*/schedule/*/marks* (PostgreSQL). No mock marks store/service/
  // types. CSV import (app/marks/import) is NOT migrated — stays on the mock
  // store, unlinked from the real flow.
  "app/marks/page.tsx",
  "app/marks/entry/page.tsx",
  "app/marks/verification/page.tsx",
  // Phase 8C — real Results & Grading (GradingScheme/GradingBand + derived
  // result computation + publication), backed by /api/results/* and
  // /api/exams/*/results*. No mock grading/result-engine authority. The
  // cross-exam /results/* hub (pipeline stages, report-card counts) and
  // /grading/rules (grace marks / attendance-eligibility policy — no real
  // backing) stay mock, unlinked from the real per-exam page.
  "app/grading/schemes/page.tsx",
  "app/exams/[examId]/results/page.tsx",
  // Phase 8D — real Report Cards: a presentation of the Phase 8C published
  // result snapshot (no ReportCard/template/generation-job model, no second
  // result-calculation engine). Fully backed by /api/report-cards/*
  // (PostgreSQL). Must never reintroduce the mock report-card template/
  // generation-job store or the mock report-card-readiness selector.
  "app/report-cards/page.tsx",
  "app/report-cards/[examId]/page.tsx",
  "app/report-cards/[examId]/[studentId]/page.tsx",
  // Phase 8E — real Promotion / Academic-Year Transition: an explicit
  // StudentPromotion decision (never automatic from a PASS/FAIL result),
  // creating a NEW target-session Enrollment. Fully backed by
  // /api/promotions/* (PostgreSQL). Must never reintroduce the mock
  // promotion-run/rule store or the mock promotion-readiness selector.
  "app/promotion/page.tsx",
  "app/promotion/run/page.tsx",
  "app/promotion/history/page.tsx",
  // Phase 9A — Teacher Experience Foundation. Main Dashboard (app/page.tsx,
  // real via GET /api/dashboard) and My Day (real Staff.userId identity,
  // real timetable/attendance/marks/exams via GET /api/my-day). Homework and
  // Lesson Plans stay honestly "not available yet" (Phase 9B/9C) — no mock
  // CURRENT_TEACHER_ID, no mock teacher-day selector, no mock dashboard
  // widget data.
  "app/page.tsx",
  "app/teacher/my-day/page.tsx",
  // Phase 9B — Homework/Assignments. Real Homework model, teacher ownership
  // via TeachingAssignment, Draft/Published/Closed lifecycle. No mock
  // homework-service, no mock teacherName/subjectName/classLabel authority.
  "app/academics/homework/page.tsx",
  "app/academics/homework/new/page.tsx",
  "app/academics/homework/[homeworkId]/page.tsx",
  "app/teacher/homework/page.tsx",
  // Phase 9C.1 — Curriculum/Syllabus Tracking. Real Curriculum -> Unit ->
  // Chapter -> Topic content + real per-Section CurriculumTopicProgress. No
  // mock curriculum-service, no mock CurriculumUnit.status/teacherId/notes.
  "app/academics/curriculum/page.tsx",
  "components/academics/curriculum/learning-path-timeline.tsx",
  // Phase 9C.2 — Lesson Plans. Real LessonPlan tied to real TeachingAssignment,
  // optional real CurriculumTopic links, Draft/Submitted/Approved/Rejected/
  // Completed lifecycle. No mock lesson-plan-service, no simulated AI
  // generation, no mock CURRENT_TEACHER_ID.
  "app/academics/lesson-plans/page.tsx",
  "app/teacher/lesson-plans/page.tsx",
  // Phase 5B — the real Student Attendance surfaces (dashboard + reports +
  // marker). Fully backed by /api/attendance/* (PostgreSQL). They must never
  // reintroduce the student-attendance mock store/hooks/selectors/seed.
  "app/attendance/page.tsx",
  "app/attendance/reports/page.tsx",
  "app/attendance/students/page.tsx",
  "app/attendance/period/page.tsx", // Phase 7C — real period/subject attendance
  "components/attendance/attendance-marker.tsx",
  // Phase 9E.1/9E.2 — real Staff Attendance (StaffAttendanceRecord) + Leave
  // Management (LeaveType/LeaveRequest), fully backed by /api/staff-attendance/*
  // and /api/leave/* (PostgreSQL). Must never reintroduce the mock
  // staff-attendance-service/leave-service or the mock db.staffAttendance/
  // useStaffAttendance/useLeaveRequests(applicantType) authority. The HR
  // module's /hr/attendance + /hr/leave stay on the mock Employee/db.hrAttendance/
  // db.hrLeaveRequests store — a separate, still-fully-mock Employee domain
  // (Phase 8 HR) not migrated here — so only these files are guarded.
  "app/attendance/staff/page.tsx",
  "app/attendance/leave/page.tsx",
  // Phase 9D.1 — Academic Calendar. Real CalendarEvent rows merged at query
  // time with events derived live from Exam schedule/Homework/Lesson Plan
  // tables. No mock academic-events selector, no client-side recurrence
  // authority. (app/academics/page.tsx hub is NOT migrated — still fully
  // mock — so only the calendar page itself is guarded.)
  "app/academics/calendar/page.tsx",
  // Phase 9D.2 — In-app Notifications. Real Notification/NotificationRecipient
  // rows via /api/notifications/*. No mock commNotifications/notification-data
  // authority, no fake unread badge.
  "app/notifications/page.tsx",
  "components/shell/notification-center.tsx",
  "components/shell/notification-trigger.tsx",
  "components/shell/shell-context.tsx",
  // Phase 9F — Fees & Collections. Real FeeCategory/FeeStructure/
  // StudentFeeAssignment/FeeCharge/FeeAdjustment/FeePayment/FeeRefund via
  // /api/fees/* (PostgreSQL). Must never reintroduce db.feeCategories/
  // feeStructures/studentFeeItems/payments/receipts/discounts/scholarships/
  // reminderRules or lib/hooks/use-finance's deleted fee-specific hooks.
  // /fees/dashboard and /fees/concessions are honest redirects (no page body
  // of their own to guard); app/pay/[linkId] is an honest deferred stub.
  // /hr/* stays on the separate, still-mock Employee/HR domain — not guarded.
  "app/fees/page.tsx",
  "app/fees/categories/page.tsx",
  "app/fees/structures/page.tsx",
  "app/fees/structures/new/page.tsx",
  "app/fees/structures/[structureId]/page.tsx",
  "app/fees/assignments/page.tsx",
  "app/fees/collection/page.tsx",
  "app/fees/collection/new/page.tsx",
  "app/fees/dues/page.tsx",
  "app/fees/receipts/page.tsx",
  "app/fees/receipts/[receiptId]/page.tsx",
  "app/fees/discounts/page.tsx",
  "app/fees/scholarships/page.tsx",
  "app/fees/fines/page.tsx",
  "app/fees/refunds/page.tsx",
  "app/fees/reconciliation/page.tsx",
  "app/fees/reminders/page.tsx",
  "app/fees/reports/page.tsx",
  "components/students/profile/student-profile.tsx",
  // Phase 9G — Accounting / General Ledger. Real AccountingAccount/
  // JournalEntry/JournalLine via /api/accounting/* (PostgreSQL). Fee payments
  // and refunds post automatically and idempotently (source-event uniqueness).
  // Must never reintroduce db.chartOfAccounts/journalEntries/ledgerEntries/
  // bankAccounts/cashAccounts/cashierShifts/bankTransactions/expenses or the
  // deleted mock chart-of-accounts/income-expense/cashier-shift services.
  // journal-service.ts was retained here pending its last consumer (the mock
  // Payroll run service) — Phase 9H deleted both together, see below.
  // Vendors/Purchase-Orders/Budgets pages stay mock (out of Phase 9G scope) —
  // not guarded here.
  "app/accounting/page.tsx",
  "app/accounting/accounts/page.tsx",
  "app/accounting/journals/page.tsx",
  "app/accounting/ledger/page.tsx",
  "app/accounting/reports/page.tsx",
  "app/accounting/dashboard/page.tsx",
  "app/accounting/income/page.tsx",
  "app/accounting/expenses/page.tsx",
  "app/accounting/expenses/new/page.tsx",
  "app/accounting/bank-reconciliation/page.tsx",
  // Phase 9H — Payroll. Real SalaryComponent/SalaryStructure/
  // StaffSalaryAssignment/PayrollRun/PayrollRunItem/PayrollPayment via
  // /api/payroll/* (PostgreSQL), posting to the REAL Phase 9G Accounting
  // ledger (no parallel journal engine). Must never reintroduce
  // db.payrollRuns/salaryStructures/payslips/employeeLoans/employeeAdvances
  // or the deleted mock payroll-run/salary-structure/loan-advance/journal
  // services. Uses the real Staff model — no second Employee model.
  // Loans/Advances/Tax pages are honest deferred stubs (no real policy).
  "app/payroll/page.tsx",
  "app/payroll/dashboard/page.tsx",
  "app/payroll/structures/page.tsx",
  "app/payroll/run/page.tsx",
  "app/payroll/history/page.tsx",
  "app/payroll/payslips/page.tsx",
  "app/payroll/payslips/[payslipId]/page.tsx",
  // Phase 9I — Visitor Management. Real Visitor/VisitorVisit via
  // /api/visitors/* (PostgreSQL); host resolved through the real Staff
  // model (Phase 6A) — never mock db.employees/hostName strings. Must never
  // reintroduce db.visitors/visitorAppointments, Math.random() badge codes,
  // or the deleted mock checkInVisitor/setVisitorStatus. app/front-desk/
  // page.tsx (hub) is a hybrid — its visitor tiles are real but it still
  // legitimately reads db.gatePasses/deliveries/receptionCalls/
  // frontDeskIncidents for unmigrated Front Desk sub-domains, so it is NOT
  // guarded here. gate-passes/calls/deliveries/incidents pages stay fully
  // mock — separate domains, out of Phase 9I scope.
  "app/front-desk/visitors/page.tsx",
  "app/front-desk/visitors/new/page.tsx",
  "app/front-desk/appointments/page.tsx",
  // Phase 9J — Teachers + Staff UI cutover. Staff remains the ONLY employee/
  // teacher identity (Phase 6A) — Teachers is a real VIEW over
  // Staff.isTeaching, not a second model. Real TeachingAssignment/Timetable/
  // Homework/LessonPlans/StaffAttendance/Leave are aggregated via
  // GET /api/staff/[staffId]/teacher-detail; Department/Designation stay
  // plain text Staff fields (no separate model exists or was created).
  // Performance/Goals/Training/Documents/Assets/Timeline/Contract/
  // Qualifications/Bank/leave-balances have no real backing anywhere in the
  // schema and show an honest "not tracked yet" state on the Staff 360 page
  // — the rest of app/hr/* (leave, attendance, appraisals, recruitment,
  // onboarding, etc.) stays on the separate, still-mock Employee/HR domain,
  // out of this phase's scope, so only these files are guarded.
  "app/teachers/page.tsx",
  "app/teachers/[teacherId]/page.tsx",
  "app/hr/staff/page.tsx",
  "app/hr/staff/new/page.tsx",
  "app/hr/staff/[staffId]/page.tsx",
  "app/hr/staff/[staffId]/edit/page.tsx",
  "app/teacher/classes/page.tsx",
  "components/hr/staff-form.tsx",
  // Phase 9K — Communication / Messaging. Real Conversation/ConversationParticipant/
  // Message via /api/communication/* (PostgreSQL). User.id is the canonical
  // messaging identity — never Staff.id, never a name string. This route used
  // to be a mock parent SMS/WhatsApp/Email broadcaster
  // (sendStudentCommunication) with no honest real backing (no Student/
  // Guardian User account exists, and an SMS/WhatsApp/email gateway is out of
  // scope) — replaced outright with real staff-to-staff messaging. Must never
  // reintroduce db.conversations/messages/conversationParticipants,
  // CURRENT_TEACHER_ID, or sendStudentCommunication. The rest of
  // app/communication/* (inbox, announcements, broadcasts, etc.) stays fully
  // mock — it mixes parent/student participants with no real User account
  // and fake delivery receipts/attachments that have no honest real backing;
  // partially migrating it would be misleading, so it is intentionally NOT
  // guarded here (see the phase's final report).
  "app/teacher/messages/page.tsx",
  // Phase 9L — Action Inbox. Pure aggregation over existing real domains
  // (Lesson Plans, Leave, Marks, Fees, Payroll, Visitors, Communication) via
  // GET /api/action-inbox — no ActionItem table, no second workflow/status.
  // The Main Dashboard widget (components/dashboard/widgets/action-inbox.tsx)
  // is already covered by the broader "components/dashboard" directory guard
  // above.
  "app/action-inbox/page.tsx",
  // Phase 9N — Library Management. Real LibraryBook/LibraryBookCopy/
  // LibraryLoan/LibraryPolicy via /api/library/* (PostgreSQL). No separate
  // LibraryMember identity — a borrower is always a real Student.id or
  // Staff.id. Accession numbers are server-generated and race-safe. Fines
  // are computed from the real, admin-editable LibraryPolicy — never
  // invented — and payment/collection is deliberately deferred. Author/
  // publisher/category are plain text fields on the book, not normalized
  // entities, so the old mock authors/publishers/categories pages have no
  // real replacement and stay fully mock (deferred), alongside reservations,
  // digital resources, the shelf hierarchy, stocktake, and barcode/QR/RFID —
  // none of that real infrastructure exists. app/library/page.tsx (hub) is a
  // hybrid — its headline stats are real but its quickLinks still legitimately
  // point at those still-mock pages — so it is NOT guarded here, matching the
  // Transport/front-desk hub precedent.
  "app/library/books/page.tsx",
  "app/library/books/new/page.tsx",
  "app/library/books/[bookId]/page.tsx",
  "app/library/catalog/page.tsx",
  "app/library/copies/page.tsx",
  "app/library/loans/page.tsx",
  "app/library/issue-return/page.tsx",
  "app/library/members/page.tsx",
  "app/library/fines/page.tsx",
  "app/library/settings/page.tsx",
  "app/library/dashboard/page.tsx",
  "app/teacher/library/page.tsx",
  // Phase 9M — Transport Management. Real TransportVehicle/TransportRoute/
  // TransportStop/TransportRouteStop/TransportRouteAssignment/
  // StudentTransportAssignment/StaffTransportAssignment/TransportTrip via
  // /api/transport/* (PostgreSQL). Drivers/Attendants are the real Staff
  // directory (no parallel Driver/Employee identity, no fake safety score).
  // No GPS/live-tracking/fuel/maintenance/incidents/documents/fees/
  // notifications — those stay fully mock (app/transport/live,
  // attendance, incidents, maintenance, fuel, documents, fees,
  // notifications, reports, settings), and app/transport/page.tsx (hub) is
  // a hybrid — its headline stats are real but it still legitimately reads
  // db.vehicleDocuments/driverDocuments for the still-mock document-expiry
  // banner — so it is NOT guarded here, matching the front-desk hub
  // precedent (Phase 9I).
  "app/transport/vehicles/page.tsx",
  "app/transport/vehicles/new/page.tsx",
  "app/transport/vehicles/[vehicleId]/page.tsx",
  "app/transport/drivers/page.tsx",
  "app/transport/attendants/page.tsx",
  "app/transport/routes/page.tsx",
  "app/transport/routes/new/page.tsx",
  "app/transport/routes/[routeId]/page.tsx",
  "app/transport/stops/page.tsx",
  "app/transport/assignments/page.tsx",
  "app/transport/student-assignments/page.tsx",
  "app/transport/staff-assignments/page.tsx",
  "app/transport/trips/page.tsx",
  "app/transport/trips/[tripId]/page.tsx",
  "app/transport/dashboard/page.tsx",
  // Phase 9O — Inventory Management. Real InventoryItem/InventoryLocation/
  // InventoryStockMovement/InventoryIssue via /api/inventory/* (PostgreSQL).
  // The movement ledger + a transactionally-maintained InventoryStockBalance
  // cache are the sole stock authority — no mutable quantity column exists
  // anywhere else. `category` is plain text (no independent category CRUD
  // existed pre-migration). Issue recipients are a real Staff.id/Student.id,
  // or a genuine OTHER descriptive label (department/classroom/event) — never
  // a name string standing in for a person. Vendors/Purchases/Stocktake's
  // procurement angle stay fully mock (no vendor/procurement system built,
  // per the phase's explicit non-negotiable rules); Stocktake itself IS real
  // (a physical count posts a real adjustment movement). app/inventory/page.tsx
  // (hub) is a hybrid — its headline stats are real but its quickLinks still
  // legitimately point at the still-mock Purchases/Vendors pages — so it is
  // NOT guarded here, matching the Library/Transport hub precedent.
  "app/inventory/dashboard/page.tsx",
  "app/inventory/items/page.tsx",
  "app/inventory/items/new/page.tsx",
  "app/inventory/items/[itemId]/page.tsx",
  "app/inventory/issues/page.tsx",
  "app/inventory/returns/page.tsx",
  "app/inventory/transfers/page.tsx",
  "app/inventory/low-stock/page.tsx",
  "app/inventory/categories/page.tsx",
  "app/inventory/stocktake/page.tsx",
  "app/inventory/reports/page.tsx",
  // Phase 9O — Asset Management. Real Asset/AssetAssignment/
  // AssetMaintenanceRecord via /api/assets/* (PostgreSQL). Every physical
  // unit is its own row with a server-generated, unique assetTag — never "10
  // laptops" as one row. Assignment is Staff-only (real Staff.id, never a
  // name string) — no existing UI ever offered a real student picker for
  // asset issue, so student assignment stays out of scope rather than being
  // fabricated. No depreciation/disposal/procurement/vendor system: `cost` is
  // shown exactly as entered. Depreciation/Disposal stay fully mock (no
  // accounting policy exists for either) — app/assets/page.tsx (hub) is a
  // hybrid — its headline stats are real but its quickLinks still legitimately
  // point at those still-mock pages — so it is NOT guarded here, matching the
  // Library/Transport hub precedent.
  "app/assets/dashboard/page.tsx",
  "app/assets/register/page.tsx",
  "app/assets/register/new/page.tsx",
  "app/assets/[assetId]/page.tsx",
  "app/assets/assignments/page.tsx",
  "app/assets/maintenance/page.tsx",
  "app/assets/audit/page.tsx",
  "app/assets/reports/page.tsx",
];

// Forbidden mock-authority markers (substring match against source text).
const FORBIDDEN: { marker: string; why: string }[] = [
  { marker: "hooks/use-store", why: "mock store hook (useSisStore)" },
  { marker: "useSisStore", why: "mock store hook" },
  { marker: "services/saas-service", why: "mock SaaS service" },
  { marker: "selectors/saas-brief", why: "mock SaaS selectors" },
  { marker: "db.saas", why: "mock SaaS store slice" },
  // Phase 5B — student-attendance mock authority (real surfaces must not import).
  { marker: 'hooks/use-attendance"', why: "mock attendance hooks (use hooks/api/use-attendance)" },
  { marker: "selectors/attendance-insights", why: "mock attendance selectors" },
  { marker: "services/attendance-service", why: "mock attendance service" },
  { marker: "data/seed/attendance", why: "mock attendance seed" },
  { marker: "data/seed/reference", why: "mock reference seed (schoolClasses/classLabel)" },
  // Phase 6 — academics-subjects mock authority (real surfaces must not import).
  { marker: 'hooks/use-academics"', why: "mock academics hooks (use hooks/api/use-academics-subjects)" },
  { marker: "services/subjects-service", why: "mock subjects service" },
  { marker: "data/seed/academics", why: "mock academics seed" },
  // Phase 6A — staff/teacher mock authority (real surfaces must use hooks/api/use-staff).
  { marker: "services/hr-service", why: "mock HR/staff service" },
  { marker: 'hooks/use-hr"', why: "mock HR hooks" },
  { marker: "data/seed/hr", why: "mock HR/staff seed" },
  // Phase 7 — timetable mock authority (real surfaces must use hooks/api/use-timetable-api).
  { marker: 'hooks/use-timetable"', why: "mock timetable hooks" },
  { marker: "services/timetable-service", why: "mock timetable service" },
  { marker: "data/seed/timetable", why: "mock timetable seed" },
  // Phase 8A — exam mock authority (real surfaces must use hooks/api/use-exams-api).
  { marker: 'hooks/use-exams"', why: "mock exam hooks" },
  { marker: "services/exam-service", why: "mock exam service" },
  { marker: "services/exam-subject-service", why: "mock exam subject service (deleted — dead import)" },
  { marker: "services/exam-schedule-service", why: "mock exam schedule service (deleted — dead import)" },
  { marker: "selectors/exams-insights", why: "mock exam Pulse/exception-feed selectors (deleted — dead import)" },
  { marker: "selectors/exam-conflicts", why: "mock exam conflict engine (deleted — dead import)" },
  { marker: "schemas/exam-form", why: "mock exam form schema (deleted — dead import)" },
  { marker: "data/seed/exams", why: "mock exam seed" },
  // Phase 8B — marks mock authority (real surfaces must use hooks/api/use-exams-api).
  { marker: '"@/lib/services/marks-service"', why: "mock marks service (still used by the deferred CSV importer — not by real surfaces)" },
  { marker: "services/marks-verification-service", why: "mock marks verification service (deleted — dead import)" },
  { marker: "services/marks-import-service", why: "mock marks import service (deferred CSV importer)" },
  { marker: "selectors/marks-summary", why: "mock marks summary selector (deleted — dead import)" },
  { marker: "types/marks", why: "mock marks types" },
  // Phase 8C — grading/result mock authority (real surfaces must use hooks/api/use-results-api).
  { marker: "services/grading-service", why: "mock grading service" },
  { marker: "services/result-engine", why: "mock result-calculation engine" },
  { marker: "services/result-processing-service", why: "mock result-processing service" },
  { marker: "selectors/grading-validation", why: "mock grading validation selector (deleted — dead import)" },
  { marker: "selectors/results-pipeline", why: "mock results pipeline selector" },
  // Phase 8D — report-card mock authority (real surfaces must use hooks/api/use-report-cards-api).
  { marker: "services/report-card-service", why: "mock report-card template/generation-job service (deleted — dead import)" },
  { marker: "selectors/report-card-readiness", why: "mock report-card readiness selector (deleted — dead import)" },
  { marker: "types/report-cards", why: "mock report-card template/job types (ReportCard/ReportCardTemplate)" },
  // Phase 8E — promotion mock authority (real surfaces must use hooks/api/use-promotions-api).
  { marker: "services/promotion-service", why: "mock promotion run/rule service (deleted — dead import)" },
  { marker: "selectors/promotion-readiness", why: "mock promotion readiness selector (deleted — dead import)" },
  { marker: "types/promotion", why: "mock promotion run/rule types (PromotionRun/PromotionRule)" },

  { marker: '"@/lib/services/homework-service"', why: "mock homework service (still used by the deferred evaluations grading page — not by real surfaces)" },
  { marker: '"@/lib/services/curriculum-service"', why: "mock curriculum unit/chapter/topic mutation service (deleted Phase 9C.1 — zero remaining consumers, dead import)" },
  { marker: '"@/lib/services/lesson-plan-service"', why: "mock lesson-plan mutation + AI-draft service (deleted Phase 9C.2 — zero remaining consumers, dead import)" },
  { marker: "lessonPlanFormSchema", why: "mock lesson-plan create-form schema (deleted Phase 9C.2 — dead import)" },
  { marker: "components/academics/homework", why: "deleted mock homework-meta helpers (dead import)" },
  // Phase 9A — dashboard/my-day mock authority (real surfaces must use hooks/api/use-dashboard-api, hooks/api/use-my-day-api).
  { marker: "dashboard/data/mock-data", why: "mock dashboard widget data generators (deleted — dead import)" },
  { marker: "selectors/teacher-day", why: "mock teacher-day selector (deleted — dead import)" },
  { marker: "lib/current-user", why: "fake CURRENT_TEACHER_ID/NAME identity — use the real Staff.userId resolver" },
  { marker: "use-widget-data", why: "mock-data-fetching widget hook (deleted — dead import)" },
  // Phase 9D.1 — calendar mock authority (real surfaces must use hooks/api/use-calendar-api).
  { marker: "selectors/calendar-occurrences", why: "mock recurrence-expansion selector (deleted — dead import)" },
  { marker: "createAcademicEvent", why: "mock academic-event mutation (deleted Phase 9D.1 — dead import)" },
  { marker: "duplicateAcademicEvent", why: "mock academic-event mutation (deleted Phase 9D.1 — dead import)" },
  // Phase 9D.2 — notification mock authority (real surfaces must use hooks/api/use-notifications-api).
  { marker: "shell/notification-data", why: "mock bell notification data (deleted — dead import)" },
  { marker: "commNotifications", why: "mock communication-notification store slice" },
  // Phase 9E — staff-attendance/leave mock authority (real surfaces must use
  // hooks/api/use-staff-attendance-api, hooks/api/use-leave-api).
  { marker: "services/staff-attendance-service", why: "mock staff-attendance service (deleted — dead import)" },
  { marker: '"@/lib/services/leave-service"', why: "mock staff/student leave-request service (deleted — dead import)" },
  { marker: "db.staffAttendance", why: "mock staff-attendance store slice (deleted — dead import)" },
  // Phase 9F — fees mock authority (real surfaces must use hooks/api/use-fees-api).
  { marker: "services/fee-category-service", why: "mock fee-category service (deleted — dead import)" },
  { marker: "services/fee-structure-service", why: "mock fee-structure service (deleted — dead import)" },
  { marker: "services/fee-assignment-service", why: "mock fee-assignment service (deleted — dead import)" },
  { marker: '"@/lib/services/student-fee-service"', why: "mock discount/scholarship/concession service (deleted — dead import)" },
  { marker: '"@/lib/services/payment-service"', why: "mock fee-payment service (deleted — dead import)" },
  { marker: "services/receipt-service", why: "mock receipt service (deleted — dead import)" },
  { marker: '"@/lib/services/reminder-service"', why: "mock fee-reminder send service (deleted — dead import)" },
  { marker: "services/reminder-rule-service", why: "mock reminder-rule service (deleted — dead import)" },
  { marker: "services/payment-link-service", why: "mock payment-link/gateway-simulation service (deleted — dead import)" },
  { marker: "selectors/dues-insights", why: "mock dues aging/metrics selector (deleted — dead import)" },
  { marker: "hooks/use-finance\"", why: "mock fees hooks (deleted from use-finance.ts — use hooks/api/use-fees-api)" },
  { marker: "simulateGatewayCallback", why: "fake payment-gateway checkout simulation (deleted — dead import)" },
  // Phase 9G — accounting mock authority (real surfaces must use hooks/api/use-accounting-api).
  { marker: "services/chart-of-accounts-service", why: "mock chart-of-accounts service (deleted — dead import)" },
  { marker: "services/income-expense-service", why: "mock income/expense service (deleted — dead import)" },
  { marker: "services/cashier-shift-service", why: "mock cashier-shift service (deleted — dead import)" },
  { marker: '"@/lib/services/journal-service"', why: "mock journal-posting service (deleted Phase 9H once its last consumer, the mock payroll-run-service, was deleted — dead import)" },
  { marker: "selectors/finance-reports", why: "mock trial-balance/income-statement/cash-flow/payroll-cost/tax-withheld selectors (deleted Phase 9G/9H — dead import)" },
  // Phase 9H — payroll mock authority (real surfaces must use hooks/api/use-payroll-api).
  { marker: "services/payroll-run-service", why: "mock payroll-run service (deleted — dead import)" },
  { marker: "services/salary-structure-service", why: "mock salary-structure service (deleted — dead import)" },
  { marker: "services/loan-advance-service", why: "mock employee loan/advance service (deleted — dead import)" },
  { marker: "selectors/salary-calc", why: "mock salary proration/resolution selector (deleted — dead import)" },
  { marker: "selectors/finance-pulse", why: "mock Finance Pulse score selector (deleted Phase 9H — dead import)" },
  { marker: "selectors/finance-brief", why: "mock finance exceptions/daily-brief selector (deleted Phase 9H — dead import)" },
  { marker: "finance/finance-pulse-gauge", why: "mock Finance Pulse gauge component (deleted Phase 9H — dead import)" },
  { marker: '"@/lib/types/payroll"', why: "mock Payroll types (SalaryStructure/PayrollRun/Payslip/EmployeeLoan) — real surfaces use lib/api/contracts.ts DTOs instead" },
  // Phase 9I — visitor mock authority (real surfaces must use hooks/api/use-visitors-api).
  { marker: "checkInVisitor", why: "mock walk-in check-in (Math.random() badge code) — deleted, dead import" },
  { marker: "setVisitorStatus", why: "mock visitor status mutation — deleted, dead import" },
  { marker: "VisitorDraft", why: "mock visitor check-in draft type — deleted, dead import" },
  { marker: "useVisitors\"", why: "mock db.visitors hook (deleted from use-communication.ts — use hooks/api/use-visitors-api)" },
  { marker: "useVisitorAppointments", why: "mock db.visitorAppointments hook (deleted — use hooks/api/use-visitors-api)" },
  { marker: "visitorStatusLabels", why: "mock visitor status label map (deleted — dead import)" },
  { marker: "visitorStatusTone", why: "mock visitor status tone map (deleted — dead import)" },
  { marker: "visitorTypeLabels", why: "mock visitor type label map (deleted — dead import)" },
  { marker: "db.employees", why: "mock Employee list used as a visitor host — real surfaces must use hooks/api/use-staff" },
  // Phase 9K — communication/messaging mock authority (real surfaces must use hooks/api/use-communication-api).
  { marker: 'hooks/use-communication"', why: "mock communication hooks (deleted from teacher/messages — use hooks/api/use-communication-api)" },
  { marker: '"@/lib/services/communication-service"', why: "mock conversation/message mutation service — real surfaces must use hooks/api/use-communication-api" },
  { marker: "sendStudentCommunication", why: "mock parent SMS/WhatsApp/email broadcast send — no real Student/Guardian User account exists, and an SMS/WhatsApp/email gateway is out of scope" },
  { marker: "db.conversations", why: "mock conversation store slice" },
  { marker: "db.conversationParticipants", why: "mock conversation-participant store slice" },
  // Phase 9M — transport mock authority (real surfaces must use hooks/api/use-transport-api).
  { marker: 'hooks/use-transport"', why: "mock transport hooks (useVehicles/useDrivers/useTransportRoutes/useTransportStops/useTransportTrips/useRouteStops — use hooks/api/use-transport-api)" },
  { marker: "services/driver-service", why: "mock driver-identity create service — drivers are real Staff, never a parallel identity" },
  { marker: "services/stop-service", why: "mock stop service (deleted authority — use hooks/api/use-transport-api)" },
  { marker: "services/trip-service", why: "mock trip service (deleted authority — use hooks/api/use-transport-api)" },
  { marker: "services/student-transport-service", why: "mock student-transport-assignment service (deleted authority — use hooks/api/use-transport-api)" },
  { marker: "services/staff-transport-service", why: "mock staff-transport-assignment service (deleted authority for real surfaces — use hooks/api/use-transport-api)" },
  { marker: "selectors/driver-safety", why: "mock driver safety-score selector — no real basis for a safety score exists" },
  { marker: "selectors/vehicle-health", why: "mock vehicle health-score selector — no real basis for a health score exists" },
  { marker: "selectors/transport-pulse", why: "mock Transport Pulse gauge selector (deleted from the dashboard — no real GPS/telemetry/delay data exists)" },
  { marker: "selectors/transport-brief", why: "mock daily transport brief/exception-feed selector (deleted from the dashboard)" },
  { marker: '"@/lib/types/transport"', why: "mock Transport types (Vehicle/Driver/TransportRoute/TransportStop/StudentTransportAssignment/TransportTrip) — real surfaces use lib/api/contracts.ts DTOs instead" },
  // Phase 9N — library mock authority (real surfaces must use hooks/api/use-library-api).
  { marker: 'hooks/use-library"', why: "mock library hooks (deleted authority for real surfaces — use hooks/api/use-library-api)" },
  { marker: "services/book-service", why: "mock book/catalog service (deleted authority for real surfaces)" },
  { marker: "services/library-member-service", why: "mock library-member service — no separate LibraryMember identity exists in the real domain" },
  { marker: "services/library-fine-service", why: "mock fine service — writes into the pre-cutover mock fee shape, incompatible with real fines" },
  { marker: "services/library-stocktake-service", why: "mock stocktake service (deferred — no real infrastructure)" },
  { marker: "services/library-reference-service", why: "mock authors/publishers/categories/shelves service — those are plain text fields on the real LibraryBook, not normalized entities" },
  { marker: "selectors/library-loan-rules", why: "mock per-category/per-role tiered loan-rule matcher — the real LibraryPolicy is a single uniform policy" },
  { marker: "selectors/book-availability", why: "mock availability selector — real availability is derived from LibraryBookCopy.status" },
  { marker: "selectors/library-brief", why: "mock library summary/exception selector (deleted from the hub/dashboard)" },
  { marker: "selectors/library-pulse", why: "mock Library Pulse selector — no real basis for a composite score exists" },
  { marker: "selectors/library-reports", why: "mock reading-engagement/popular-book/trend selector — no real backing exists" },
  { marker: '"@/lib/types/library"', why: "mock Library types (Book/BookCopy/LibraryMember/LibraryLoan/LibraryReservation/LibraryFine) — real surfaces use lib/api/contracts.ts DTOs instead" },
  { marker: "components/library/catalogue-view", why: "mock catalogue component bound to the mock Book/BookCopy/Author/Publisher/Category types — real surfaces render their own real list" },
  // Phase 9O — inventory/asset mock authority (real surfaces must use
  // hooks/api/use-inventory-api, hooks/api/use-assets-api).
  { marker: "services/inventory-service", why: "mock inventory mutation service (deleted — zero remaining consumers, dead import)" },
  { marker: "services/asset-service", why: "mock asset mutation service — still consumed by the deferred Depreciation page, but real surfaces must use hooks/api/use-assets-api" },
  { marker: "selectors/inventory-brief", why: "mock inventory summary selector (deleted — zero remaining consumers, dead import)" },
  { marker: "selectors/asset-brief", why: "mock asset summary selector (deleted — zero remaining consumers, dead import)" },
  { marker: "selectors/asset-depreciation", why: "mock depreciation-schedule/book-value selector — this phase does not fabricate depreciation" },
  { marker: '"@/lib/types/inventory"', why: "mock Inventory types (InventoryItem/InventoryCategory/InventoryIssue/InventoryTransfer/PurchaseRequest) — still consumed by the deferred Purchases page, but real surfaces use lib/api/contracts.ts DTOs instead" },
  { marker: '"@/lib/types/assets"', why: "mock Asset types (Asset/AssetCategory/AssetDisposal/depreciation fields) — still consumed by the deferred Depreciation/Disposal pages, but real surfaces use lib/api/contracts.ts DTOs instead" },
  { marker: "data/seed/inventory", why: "mock inventory seed data — still consumed by the deferred Purchases page's store slice, but real surfaces must never read seed data" },
  { marker: "data/seed/assets", why: "mock asset seed data — still consumed by the deferred Depreciation/Disposal pages' store slice, but real surfaces must never read seed data" },
  { marker: "library/resource-audit-trail", why: "mock append-only resource-audit-log component with zero real backing — real Inventory/Asset surfaces use the movement ledger / a real AuditEvent-backed history endpoint instead" },
];

function collectSources(dir: string): string[] {
  const abs = join(ROOT, dir);
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d)) {
      const p = join(d, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(tsx?|jsx?)$/.test(entry)) out.push(p);
    }
  };
  walk(abs);
  return out;
}

function offendersIn(files: string[]): string[] {
  const offenders: string[] = [];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const { marker, why } of FORBIDDEN) {
      if (src.includes(marker)) offenders.push(`${file.replace(ROOT + "/", "")} → ${marker} (${why})`);
    }
  }
  return offenders;
}

describe("migrated Super Admin routes contain no mock dependency", () => {
  for (const dir of MIGRATED_ROUTE_DIRS) {
    it(`${dir} is mock-free`, () => {
      const files = collectSources(dir);
      expect(files.length).toBeGreaterThan(0);
      const offenders = offendersIn(files);
      expect(offenders, offenders.join("\n")).toEqual([]);
    });
  }

  for (const file of MIGRATED_FILES) {
    it(`${file} is mock-free`, () => {
      const offenders = offendersIn([join(ROOT, file)]);
      expect(offenders, offenders.join("\n")).toEqual([]);
    });
  }
});
