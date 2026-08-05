import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { archiveStudent, bulkUpdateStatus, isDuplicateAdmissionNumber, markAttendance, recordFeePayment } from "./students-service";

describe("isDuplicateAdmissionNumber", () => {
  beforeEach(() => resetDemoData());

  it("flags an admission number already used by another student", () => {
    const db = getSnapshot();
    const existing = db.students[0].admissionNumber;
    expect(isDuplicateAdmissionNumber(db, existing)).toBe(true);
  });

  it("does not flag a brand-new admission number", () => {
    const db = getSnapshot();
    expect(isDuplicateAdmissionNumber(db, "TOTALLY-NEW-NUMBER-999")).toBe(false);
  });

  it("excludes the student's own record when editing in place", () => {
    const db = getSnapshot();
    const student = db.students[0];
    expect(isDuplicateAdmissionNumber(db, student.admissionNumber, student.id)).toBe(false);
  });

  it("is case-insensitive", () => {
    const db = getSnapshot();
    const existing = db.students[0].admissionNumber;
    expect(isDuplicateAdmissionNumber(db, existing.toLowerCase())).toBe(true);
    expect(isDuplicateAdmissionNumber(db, existing.toUpperCase())).toBe(true);
  });
});

describe("markAttendance", () => {
  beforeEach(() => resetDemoData());

  it("updates today's status and increments the matching day counter", () => {
    const student = getSnapshot().students[0];
    const presentDaysBefore = student.attendance.presentDays;

    markAttendance(student.id, "present", "Class Teacher");

    const updated = getSnapshot().students.find((s) => s.id === student.id)!;
    expect(updated.attendance.todayStatus).toBe("present");
    expect(updated.attendance.presentDays).toBe(presentDaysBefore + 1);
  });
});

describe("recordFeePayment", () => {
  beforeEach(() => resetDemoData());

  it("marks fees as paid once the full due amount is covered", () => {
    const student = getSnapshot().students.find((s) => s.fees.status !== "paid")!;
    const remaining = student.fees.totalDue - student.fees.totalPaid;

    recordFeePayment(student.id, remaining, "UPI", "Accountant");

    const updated = getSnapshot().students.find((s) => s.id === student.id)!;
    expect(updated.fees.status).toBe("paid");
    expect(updated.fees.overdueAmount).toBe(0);
  });

  it("marks fees as partial when less than the full due amount is paid", () => {
    const student = getSnapshot().students.find((s) => s.fees.status === "pending")!;

    recordFeePayment(student.id, 100, "Cash", "Accountant");

    const updated = getSnapshot().students.find((s) => s.id === student.id)!;
    expect(updated.fees.status).toBe("partial");
  });
});

describe("archiveStudent", () => {
  beforeEach(() => resetDemoData());

  it("sets status to archived and leaves other students untouched", () => {
    const [target, other] = getSnapshot().students;
    archiveStudent(target.id, "Administrator");

    const db = getSnapshot();
    expect(db.students.find((s) => s.id === target.id)?.status).toBe("archived");
    expect(db.students.find((s) => s.id === other.id)?.status).toBe(other.status);
  });
});

describe("bulkUpdateStatus", () => {
  beforeEach(() => resetDemoData());

  it("updates status for exactly the selected students", () => {
    const students = getSnapshot().students.slice(0, 3);
    const ids = students.map((s) => s.id);
    const untouchedBefore = getSnapshot().students.find((s) => !ids.includes(s.id))!;
    const untouchedOriginalStatus = untouchedBefore.status;

    bulkUpdateStatus(ids, "inactive", "Administrator");

    const db = getSnapshot();
    for (const id of ids) {
      expect(db.students.find((s) => s.id === id)?.status).toBe("inactive");
    }
    expect(db.students.find((s) => s.id === untouchedBefore.id)?.status).toBe(untouchedOriginalStatus);
  });
});
