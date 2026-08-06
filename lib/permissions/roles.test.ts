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

describe("hasAnyPermission", () => {
  it("returns true if the role has at least one of the listed permissions", () => {
    expect(hasAnyPermission("teacher", ["admissions.approve", "students.view"])).toBe(true);
  });

  it("returns false if the role has none of the listed permissions", () => {
    expect(hasAnyPermission("student", ["admissions.approve", "fees.record"])).toBe(false);
  });
});
