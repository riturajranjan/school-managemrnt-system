import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { sendBulkReminders, sendManualReminder } from "./reminder-service";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };

describe("sendManualReminder", () => {
  beforeEach(() => resetDemoData());

  it("appends a reminder log entry for the student", () => {
    const student = getSnapshot().students[0];
    const log = sendManualReminder(student.id, "sms", ACTOR);
    const after = getSnapshot();
    expect(after.reminderLog[0].id).toBe(log.id);
    expect(after.reminderLog[0].studentId).toBe(student.id);
    expect(after.reminderLog[0].channel).toBe("sms");
  });

  it("records a financial audit entry for the send", () => {
    const student = getSnapshot().students[0];
    const auditBefore = getSnapshot().financialAuditLog.length;
    sendManualReminder(student.id, "email", ACTOR);
    expect(getSnapshot().financialAuditLog.length).toBe(auditBefore + 1);
  });
});

describe("sendBulkReminders", () => {
  beforeEach(() => resetDemoData());

  it("sends one reminder per student in the list", () => {
    const students = getSnapshot().students.slice(0, 3);
    const logs = sendBulkReminders(students.map((s) => s.id), "in-app", ACTOR);
    expect(logs.length).toBe(3);
    expect(getSnapshot().reminderLog.length).toBe(3);
  });
});
