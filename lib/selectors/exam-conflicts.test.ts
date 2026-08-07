import { describe, expect, it } from "vitest";
import { detectExamConflicts, summarizeExamConflicts } from "./exam-conflicts";
import type { Db } from "@/lib/data/store";
import type { ExamSubject } from "@/lib/types/exams";

function subject(id: string, overrides: Partial<ExamSubject> = {}): ExamSubject {
  return {
    id,
    examId: "exam-1",
    classId: "class-1",
    sectionId: "section-1",
    subjectId: "subject-1",
    date: "2026-08-10",
    startTime: "09:00",
    endTime: "11:00",
    maxMarks: 100,
    passingMarks: 33,
    theoryMarks: 100,
    practicalMarks: 0,
    internalMarks: 0,
    projectMarks: 0,
    graceMarksLimit: 5,
    weightage: 100,
    locked: false,
    ...overrides,
  };
}

function makeDb(examSubjects: ExamSubject[], overrides: Partial<Db> = {}): Db {
  return {
    applications: [],
    students: [],
    guardians: [],
    studentGuardianLinks: [],
    parentAccounts: [],
    importJobs: [],
    savedViews: [],
    classes: [{ id: "class-1", name: "Class 1", order: 1, status: "active", sections: [{ id: "section-1", classId: "class-1", name: "A", capacity: 30, enrolledCount: 30, shift: "morning" }] }],
    teachers: [],
    rooms: [{ id: "room-1", name: "Room 1", type: "classroom", capacity: 30 }],
    subjects: [],
    subjectAssignments: [],
    curriculumUnits: [],
    lessonPlans: [],
    homework: [],
    homeworkSubmissions: [],
    academicEvents: [],
    studentSupportAlerts: [],
    attendanceSessions: [],
    attendanceRules: [],
    leaveRequests: [],
    staffAttendance: [],
    timetables: [],
    dismissedConflicts: [],
    exams: [],
    examClasses: [],
    examSubjects,
    dismissedExamConflicts: [],
    examAttendance: [],
    studentMarks: [],
    marksEntrySessions: [],
    marksVerifications: [],
    gradingSchemes: [],
    resultRules: [],
    examResults: [],
    resultVersions: [],
    resultPublications: [],
    reportCardTemplates: [],
    reportCards: [],
    reportCardGenerationJobs: [],
    teacherRemarks: [],
    promotionRules: [],
    promotionRuns: [],
    examAuditLog: [],
    feeCategories: [],
    feeStructures: [],
    feeRules: [],
    studentFeeAssignments: [],
    studentFeeItems: [],
    discounts: [],
    concessions: [],
    scholarships: [],
    lateFeeRules: [],
    reminderRules: [],
    reminderLog: [],
    invoices: [],
    payments: [],
    paymentAllocations: [],
    paymentLinks: [],
    receipts: [],
    refunds: [],
    creditBalances: [],
    bankTransactions: [],
    reconciliationRecords: [],
    incomes: [],
    expenses: [],
    vendors: [],
    purchaseOrders: [],
    chartOfAccounts: [],
    journalEntries: [],
    ledgerEntries: [],
    bankAccounts: [],
    cashAccounts: [],
    cashierShifts: [],
    budgets: [],
    salaryStructures: [],
    payrollRuns: [],
    payslips: [],
    employeeLoans: [],
    employeeAdvances: [],
    financialAuditLog: [],
    transportStops: [],
    transportRoutes: [],
    routeStops: [],
    vehicles: [],
    vehicleSeats: [],
    vehicleDocuments: [],
    vehicleAssignments: [],
    drivers: [],
    driverDocuments: [],
    driverTraining: [],
    driverAvailability: [],
    attendants: [],
    studentTransportAssignments: [],
    staffTransportAssignments: [],
    transportTrips: [],
    tripStops: [],
    tripStudents: [],
    pickupRecords: [],
    dropRecords: [],
    transportAttendance: [],
    gpsDevices: [],
    gpsPositions: [],
    routeDeviations: [],
    transportIncidents: [],
    maintenanceRecords: [],
    fuelRecords: [],
    transportNotificationRules: [],
    transportNotifications: [],
    transportShiftPolicies: [],
    transportFeeRules: [],
    transportFeeCharges: [],
    transportAuditLog: [],
    libraries: [],
    shelfLocations: [],
    shelves: [],
    authors: [],
    publishers: [],
    bookCategories: [],
    books: [],
    bookCopies: [],
    libraryMembers: [],
    libraryRules: [],
    libraryLoans: [],
    libraryReservations: [],
    libraryFines: [],
    digitalResources: [],
    digitalResourceAccess: [],
    libraryStocktakes: [],
    libraryStocktakeItems: [],
    inventoryCategories: [],
    inventoryItems: [],
    inventoryMovements: [],
    inventoryIssues: [],
    inventoryReturns: [],
    inventoryTransfers: [],
    inventoryPurchaseRequests: [],
    inventoryStocktakes: [],
    inventoryStocktakeLines: [],
    assetCategories: [],
    assets: [],
    assetAssignments: [],
    assetMaintenance: [],
    assetDepreciation: [],
    assetDisposals: [],
    resourceAuditLog: [],
    departments: [],
    designations: [],
    shifts: [],
    employees: [],
    contracts: [],
    staffDocuments: [],
    hrAttendance: [],
    leaveBalances: [],
    hrLeaveRequests: [],
    recruitmentJobs: [],
    candidates: [],
    interviews: [],
    onboardingTasks: [],
    offboardingCases: [],
    performanceCycles: [],
    performanceReviews: [],
    performanceGoals: [],
    hrFeedback: [],
    trainingCourses: [],
    trainingEnrollments: [],
    employeeAssets: [],
    employeeTimeline: [],
    staffLetters: [],
    hrAnnouncements: [],
    hrPolicies: [],
    conversations: [],
    conversationParticipants: [],
    messages: [],
    commGroups: [],
    commAnnouncements: [],
    commNotices: [],
    commBroadcasts: [],
    scheduledCommunications: [],
    commTemplates: [],
    commNotifications: [],
    notificationSettings: { preferences: [], quietHoursStart: "21:00", quietHoursEnd: "07:00", language: "en", digest: "off", emergencyOverride: true },
    helpdeskTickets: [],
    ticketReplies: [],
    knowledgeArticles: [],
    visitors: [],
    visitorAppointments: [],
    gatePasses: [],
    receptionCalls: [],
    deliveries: [],
    frontDeskIncidents: [],
    ...overrides,
  };
}

describe("detectExamConflicts", () => {
  it("flags a section double-booked at overlapping times as student-overlap", () => {
    const db = makeDb([subject("s1", { sectionId: "section-1" }), subject("s2", { sectionId: "section-1", subjectId: "subject-2", startTime: "10:00", endTime: "12:00" })]);
    const conflicts = detectExamConflicts(db);
    expect(conflicts.some((c) => c.type === "student-overlap")).toBe(true);
  });

  it("does not flag two subjects in the same section on the same day when they don't overlap", () => {
    const db = makeDb([subject("s1", { startTime: "09:00", endTime: "11:00" }), subject("s2", { subjectId: "subject-2", startTime: "11:30", endTime: "13:00" })]);
    const conflicts = detectExamConflicts(db);
    expect(conflicts.some((c) => c.type === "student-overlap")).toBe(false);
  });

  it("flags the same room booked for two overlapping exams in different sections", () => {
    const db = makeDb([subject("s1", { roomId: "room-1" }), subject("s2", { sectionId: "section-2", roomId: "room-1", startTime: "10:00", endTime: "12:00" })]);
    const conflicts = detectExamConflicts(db);
    expect(conflicts.some((c) => c.type === "room-overlap")).toBe(true);
  });

  it("flags the same invigilator assigned to two overlapping exams", () => {
    const db = makeDb([subject("s1", { invigilatorId: "teacher-1" }), subject("s2", { sectionId: "section-2", invigilatorId: "teacher-1", startTime: "10:00", endTime: "12:00" })]);
    const conflicts = detectExamConflicts(db);
    expect(conflicts.some((c) => c.type === "invigilator-overlap")).toBe(true);
  });

  it("flags a room that can't seat all eligible students", () => {
    const db = makeDb([subject("s1", { roomId: "room-1" })], {
      classes: [{ id: "class-1", name: "Class 1", order: 1, status: "active", sections: [{ id: "section-1", classId: "class-1", name: "A", capacity: 50, enrolledCount: 45, shift: "morning" }] }],
    });
    const conflicts = detectExamConflicts(db);
    expect(conflicts.some((c) => c.type === "room-capacity")).toBe(true);
  });

  it("flags insufficient gap between two same-day, same-section exams", () => {
    const db = makeDb([subject("s1", { startTime: "09:00", endTime: "11:00" }), subject("s2", { subjectId: "subject-2", startTime: "11:10", endTime: "13:00" })]);
    const conflicts = detectExamConflicts(db);
    expect(conflicts.some((c) => c.type === "insufficient-gap")).toBe(true);
  });

  it("flags an exam scheduled outside school hours", () => {
    const db = makeDb([subject("s1", { startTime: "18:00", endTime: "20:00" })]);
    const conflicts = detectExamConflicts(db);
    expect(conflicts.some((c) => c.type === "outside-school-hours")).toBe(true);
  });

  it("flags an exam scheduled on a declared holiday", () => {
    const db = makeDb([subject("s1", { date: "2026-08-15" })], {
      academicEvents: [{ id: "evt-1", title: "Independence Day", type: "holiday", startDate: "2026-08-15", allDay: true, audience: ["all"], createdBy: "Admin" }],
    });
    const conflicts = detectExamConflicts(db);
    expect(conflicts.some((c) => c.type === "holiday-conflict")).toBe(true);
  });

  it("does not flag anything for a clean, well-spaced schedule", () => {
    const db = makeDb([subject("s1", { startTime: "09:00", endTime: "11:00" }), subject("s2", { subjectId: "subject-2", sectionId: "section-2", startTime: "09:00", endTime: "11:00", roomId: "room-2", invigilatorId: "teacher-2" })], {
      rooms: [
        { id: "room-1", name: "Room 1", type: "classroom", capacity: 30 },
        { id: "room-2", name: "Room 2", type: "classroom", capacity: 30 },
      ],
      classes: [
        {
          id: "class-1",
          name: "Class 1",
          order: 1,
          status: "active",
          sections: [
            { id: "section-1", classId: "class-1", name: "A", capacity: 30, enrolledCount: 20, shift: "morning" },
            { id: "section-2", classId: "class-1", name: "B", capacity: 30, enrolledCount: 20, shift: "morning" },
          ],
        },
      ],
    });
    const conflicts = detectExamConflicts(db);
    expect(summarizeExamConflicts(conflicts).total).toBe(0);
  });

  it("ignores unscheduled exam subjects (no date/time set)", () => {
    const db = makeDb([subject("s1", { date: undefined, startTime: undefined, endTime: undefined })]);
    const conflicts = detectExamConflicts(db);
    expect(conflicts).toHaveLength(0);
  });
});
