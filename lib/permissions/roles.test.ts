import { describe, expect, it } from "vitest";
import { hasAnyPermission, hasPermission } from "./roles";

describe("hasPermission", () => {
  it("lets a super-admin approve admissions", () => {
    expect(hasPermission("super-admin", "admissions.approve")).toBe(true);
  });

  it("lets an admission officer create and edit admissions but not approve them", () => {
    expect(hasPermission("admission-officer", "admissions.create")).toBe(true);
    expect(hasPermission("admission-officer", "admissions.edit")).toBe(true);
    expect(hasPermission("admission-officer", "admissions.approve")).toBe(false);
  });

  it("keeps teachers from editing sensitive admission or finance data", () => {
    expect(hasPermission("teacher", "students.view")).toBe(true);
    expect(hasPermission("teacher", "admissions.edit")).toBe(false);
    expect(hasPermission("teacher", "fees.record")).toBe(false);
    expect(hasPermission("teacher", "students.edit")).toBe(false);
  });

  it("lets an accountant view fee-related student information without editing student profiles", () => {
    expect(hasPermission("accountant", "fees.view")).toBe(true);
    expect(hasPermission("accountant", "fees.record")).toBe(true);
    expect(hasPermission("accountant", "students.edit")).toBe(false);
  });

  it("restricts a parent to viewing their own linked children's data", () => {
    expect(hasPermission("parent", "students.view")).toBe(true);
    expect(hasPermission("parent", "students.edit")).toBe(false);
    expect(hasPermission("parent", "admissions.view")).toBe(false);
  });

  it("restricts a student role to view-only access", () => {
    expect(hasPermission("student", "students.view")).toBe(true);
    expect(hasPermission("student", "students.edit")).toBe(false);
    expect(hasPermission("student", "fees.view")).toBe(false);
  });
});

describe("Phase 3 academic permissions", () => {
  it("lets an academic coordinator manage curriculum, timetable and lesson-plan approvals", () => {
    expect(hasPermission("academic-coordinator", "academics.manageCurriculum")).toBe(true);
    expect(hasPermission("academic-coordinator", "timetable.manage")).toBe(true);
    expect(hasPermission("academic-coordinator", "lessonPlans.approve")).toBe(true);
  });

  it("lets a teacher manage assigned classes, attendance, lesson plans and homework but not approve their own plans", () => {
    expect(hasPermission("teacher", "attendance.markOwn")).toBe(true);
    expect(hasPermission("teacher", "lessonPlans.create")).toBe(true);
    expect(hasPermission("teacher", "homework.manage")).toBe(true);
    expect(hasPermission("teacher", "lessonPlans.approve")).toBe(false);
  });

  it("keeps an accountant from confidential staff attendance unless explicitly granted", () => {
    expect(hasPermission("accountant", "staffAttendance.view")).toBe(false);
  });

  it("restricts a parent to their own linked children's academic information", () => {
    expect(hasPermission("parent", "academics.view")).toBe(true);
    expect(hasPermission("parent", "attendance.viewOwn")).toBe(true);
    expect(hasPermission("parent", "attendance.viewAny")).toBe(false);
  });

  it("lets a student view only their own timetable, homework and attendance", () => {
    expect(hasPermission("student", "timetable.view")).toBe(true);
    expect(hasPermission("student", "homework.submit")).toBe(true);
    expect(hasPermission("student", "attendance.viewOwn")).toBe(true);
    expect(hasPermission("student", "attendance.viewAny")).toBe(false);
    expect(hasPermission("student", "academics.manageClasses")).toBe(false);
  });
});

describe("Phase 4 examination permissions", () => {
  it("gives the examination controller full control of the exam pipeline", () => {
    expect(hasPermission("examination-controller", "exams.create")).toBe(true);
    expect(hasPermission("examination-controller", "exams.manageSchedule")).toBe(true);
    expect(hasPermission("examination-controller", "marks.lock")).toBe(true);
    expect(hasPermission("examination-controller", "results.calculate")).toBe(true);
    expect(hasPermission("examination-controller", "results.publish")).toBe(true);
    expect(hasPermission("examination-controller", "reportCards.generate")).toBe(true);
  });

  it("lets a teacher enter and submit marks but not verify, calculate, or publish results", () => {
    expect(hasPermission("teacher", "marks.enter")).toBe(true);
    expect(hasPermission("teacher", "marks.verify")).toBe(true);
    expect(hasPermission("teacher", "marks.approve")).toBe(false);
    expect(hasPermission("teacher", "results.calculate")).toBe(false);
    expect(hasPermission("teacher", "results.publish")).toBe(false);
  });

  it("lets the principal approve and publish but not enter marks or manage schedules", () => {
    expect(hasPermission("principal", "marks.approve")).toBe(true);
    expect(hasPermission("principal", "results.publish")).toBe(true);
    expect(hasPermission("principal", "promotion.approve")).toBe(true);
    expect(hasPermission("principal", "marks.enter")).toBe(false);
    expect(hasPermission("principal", "exams.manageSchedule")).toBe(false);
  });

  it("restricts students and parents to viewing their own exams, results and report cards only", () => {
    for (const role of ["student", "parent"] as const) {
      expect(hasPermission(role, "exams.view")).toBe(true);
      expect(hasPermission(role, "results.view")).toBe(true);
      expect(hasPermission(role, "reportCards.view")).toBe(true);
      expect(hasPermission(role, "results.viewAnalytics")).toBe(false);
      expect(hasPermission(role, "marks.enter")).toBe(false);
      expect(hasPermission(role, "results.publish")).toBe(false);
      expect(hasPermission(role, "promotion.run")).toBe(false);
    }
  });

  it("keeps promotion execution limited to coordinator, controller and super-admin", () => {
    expect(hasPermission("academic-coordinator", "promotion.run")).toBe(true);
    expect(hasPermission("examination-controller", "promotion.run")).toBe(true);
    expect(hasPermission("super-admin", "promotion.run")).toBe(true);
    expect(hasPermission("teacher", "promotion.run")).toBe(false);
    expect(hasPermission("accountant", "promotion.run")).toBe(false);
  });

  it("does not grant admission-officer or accountant any exam permissions", () => {
    expect(hasAnyPermission("admission-officer", ["exams.view", "marks.enter", "results.view", "reportCards.view", "promotion.view"])).toBe(false);
    expect(hasAnyPermission("accountant", ["exams.view", "marks.enter", "results.view", "reportCards.view", "promotion.view"])).toBe(false);
  });
});

describe("Phase 5 finance permissions", () => {
  it("gives the finance administrator full operational control of fees, accounting and payroll", () => {
    expect(hasPermission("finance-administrator", "fees.manageStructures")).toBe(true);
    expect(hasPermission("finance-administrator", "fees.approveRefund")).toBe(true);
    expect(hasPermission("finance-administrator", "accounting.postJournals")).toBe(true);
    expect(hasPermission("finance-administrator", "accounting.approveBudgets")).toBe(true);
    expect(hasPermission("finance-administrator", "payroll.run")).toBe(true);
    expect(hasPermission("finance-administrator", "payroll.approve")).toBe(true);
  });

  it("lets an accountant record and reconcile but not manage fee structures or approve refunds", () => {
    expect(hasPermission("accountant", "fees.record")).toBe(true);
    expect(hasPermission("accountant", "fees.reconcile")).toBe(true);
    expect(hasPermission("accountant", "accounting.postJournals")).toBe(true);
    expect(hasPermission("accountant", "fees.manageStructures")).toBe(false);
    expect(hasPermission("accountant", "fees.approveRefund")).toBe(false);
    expect(hasPermission("accountant", "accounting.manageChartOfAccounts")).toBe(false);
  });

  it("restricts a cashier to collecting payments within the fee module only", () => {
    expect(hasPermission("cashier", "fees.record")).toBe(true);
    expect(hasPermission("cashier", "fees.manageStructures")).toBe(false);
    expect(hasPermission("cashier", "fees.refund")).toBe(false);
    expect(hasPermission("cashier", "accounting.view")).toBe(false);
    expect(hasPermission("cashier", "payroll.view")).toBe(false);
  });

  it("lets a school owner and principal approve at the oversight level without day-to-day recording rights", () => {
    for (const role of ["school-owner", "principal"] as const) {
      expect(hasPermission(role, "accounting.approveExpenses")).toBe(true);
      expect(hasPermission(role, "payroll.approve")).toBe(true);
      expect(hasPermission(role, "fees.record")).toBe(false);
      expect(hasPermission(role, "accounting.manageExpenses")).toBe(false);
    }
  });

  it("keeps an auditor strictly read-only, even for actions oversight roles can approve", () => {
    expect(hasPermission("auditor", "fees.view")).toBe(true);
    expect(hasPermission("auditor", "accounting.viewLedger")).toBe(true);
    expect(hasPermission("auditor", "finance.auditView")).toBe(true);
    expect(hasPermission("auditor", "fees.record")).toBe(false);
    expect(hasPermission("auditor", "fees.approveRefund")).toBe(false);
    expect(hasPermission("auditor", "accounting.approveExpenses")).toBe(false);
    expect(hasPermission("auditor", "payroll.approve")).toBe(false);
    expect(hasPermission("auditor", "payroll.run")).toBe(false);
  });

  it("scopes parents and students to their own fee information, not staff-level access", () => {
    expect(hasPermission("parent", "fees.viewOwn")).toBe(true);
    expect(hasPermission("parent", "fees.payOwn")).toBe(true);
    expect(hasPermission("parent", "fees.record")).toBe(false);
    expect(hasPermission("student", "fees.viewOwn")).toBe(true);
    expect(hasPermission("student", "fees.payOwn")).toBe(true);
    expect(hasPermission("student", "fees.view")).toBe(false);
  });

  it("keeps a teacher with no financial access unless explicitly granted", () => {
    expect(hasAnyPermission("teacher", ["fees.view", "fees.record", "fees.viewOwn", "accounting.view", "payroll.view"])).toBe(false);
  });

  it("lets an admission officer view and collect fees but not manage structures or reports", () => {
    expect(hasPermission("admission-officer", "fees.view")).toBe(true);
    expect(hasPermission("admission-officer", "fees.record")).toBe(true);
    expect(hasPermission("admission-officer", "fees.manageStructures")).toBe(false);
    expect(hasPermission("admission-officer", "fees.viewReports")).toBe(false);
  });

  it("gives Transport Administrator full route/vehicle/driver control but keeps Transport Manager limited to daily operations", () => {
    expect(hasPermission("transport-administrator", "transport.manageRoutes")).toBe(true);
    expect(hasPermission("transport-administrator", "transport.manageVehicles")).toBe(true);
    expect(hasPermission("transport-administrator", "transport.manageSettings")).toBe(true);
    expect(hasPermission("transport-manager", "transport.manageRoutes")).toBe(false);
    expect(hasPermission("transport-manager", "transport.manageVehicles")).toBe(false);
    expect(hasPermission("transport-manager", "transport.manageSettings")).toBe(false);
    expect(hasPermission("transport-manager", "transport.manageTrips")).toBe(true);
    expect(hasPermission("transport-manager", "transport.manageMaintenance")).toBe(true);
  });

  it("scopes driver and attendant to their own operational access, not fleet management", () => {
    expect(hasPermission("driver", "transport.driverAccess")).toBe(true);
    expect(hasPermission("driver", "transport.manageVehicles")).toBe(false);
    expect(hasPermission("driver", "transport.manageRoutes")).toBe(false);
    expect(hasPermission("attendant", "transport.attendantAccess")).toBe(true);
    expect(hasPermission("attendant", "transport.markAttendance")).toBe(true);
    expect(hasPermission("attendant", "transport.manageVehicles")).toBe(false);
  });

  it("keeps a dispatcher able to monitor and communicate but not manage the fleet or approve incidents", () => {
    expect(hasPermission("dispatcher", "transport.viewLive")).toBe(true);
    expect(hasPermission("dispatcher", "transport.manageTrips")).toBe(true);
    expect(hasPermission("dispatcher", "transport.manageVehicles")).toBe(false);
    expect(hasPermission("dispatcher", "transport.manageDrivers")).toBe(false);
  });

  it("scopes parent and student transport visibility to their own record only", () => {
    expect(hasPermission("parent", "transport.viewOwn")).toBe(true);
    expect(hasPermission("parent", "transport.view")).toBe(false);
    expect(hasPermission("parent", "transport.manageRoutes")).toBe(false);
    expect(hasPermission("student", "transport.viewOwn")).toBe(true);
    expect(hasPermission("student", "transport.manageTrips")).toBe(false);
  });

  it("keeps an auditor read-only for transport too — visibility without any manage/approve permission", () => {
    expect(hasPermission("auditor", "transport.view")).toBe(true);
    expect(hasPermission("auditor", "transport.viewReports")).toBe(true);
    expect(hasPermission("auditor", "transport.manageRoutes")).toBe(false);
    expect(hasPermission("auditor", "transport.manageVehicles")).toBe(false);
    expect(hasPermission("auditor", "transport.manageIncidents")).toBe(false);
  });
});

describe("hasAnyPermission", () => {
  it("returns true if the role has at least one of the listed permissions", () => {
    expect(hasAnyPermission("teacher", ["admissions.approve", "students.view"])).toBe(true);
  });

  it("returns false if the role has none of the listed permissions", () => {
    expect(hasAnyPermission("student", ["admissions.approve", "fees.record"])).toBe(false);
  });
});
