import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { findSession, isWithinEditWindow, saveAttendanceSession, updateRecordStatus } from "./attendance-service";

describe("saveAttendanceSession", () => {
  beforeEach(() => resetDemoData());

  it("creates a new session when none exists for that class/date/mode", () => {
    const db = getSnapshot();
    const section = db.classes[6].sections[0];
    const students = db.students.filter((s) => s.sectionId === section.id).slice(0, 3);
    const date = new Date().toISOString();

    const session = saveAttendanceSession({
      classId: db.classes[6].id,
      sectionId: section.id,
      date,
      mode: "daily",
      records: students.map((s) => ({ studentId: s.id, status: "present" as const })),
      markedBy: "Test Teacher",
    });

    expect(session.records).toHaveLength(students.length);
    expect(findSession(section.id, date, "daily")).toBeDefined();
  });

  it("updates the existing session instead of creating a duplicate for the same class/date/mode", () => {
    const db = getSnapshot();
    const section = db.classes[6].sections[0];
    const students = db.students.filter((s) => s.sectionId === section.id).slice(0, 2);
    const date = new Date().toISOString();

    saveAttendanceSession({ classId: db.classes[6].id, sectionId: section.id, date, mode: "daily", records: students.map((s) => ({ studentId: s.id, status: "present" as const })), markedBy: "A" });
    saveAttendanceSession({ classId: db.classes[6].id, sectionId: section.id, date, mode: "daily", records: students.map((s) => ({ studentId: s.id, status: "absent" as const })), markedBy: "B" });

    const sessionsForDay = getSnapshot().attendanceSessions.filter((s) => s.sectionId === section.id && s.date === date && s.mode === "daily");
    expect(sessionsForDay).toHaveLength(1);
    expect(sessionsForDay[0].records[0].status).toBe("absent");
  });
});

describe("updateRecordStatus", () => {
  beforeEach(() => resetDemoData());

  it("updates only the targeted student's record", () => {
    const session = getSnapshot().attendanceSessions.find((s) => s.records.length >= 2)!;
    const [target, other] = session.records;
    const otherStatusBefore = other.status;

    updateRecordStatus(session.id, target.studentId, "late", "Bus delay");

    const updated = getSnapshot().attendanceSessions.find((s) => s.id === session.id)!;
    expect(updated.records.find((r) => r.studentId === target.studentId)?.status).toBe("late");
    expect(updated.records.find((r) => r.studentId === target.studentId)?.note).toBe("Bus delay");
    expect(updated.records.find((r) => r.studentId === other.studentId)?.status).toBe(otherStatusBefore);
  });
});

describe("isWithinEditWindow", () => {
  it("allows edits within the configured lock window", () => {
    const session = { markedAt: new Date().toISOString() } as Parameters<typeof isWithinEditWindow>[0];
    expect(isWithinEditWindow(session, 24)).toBe(true);
  });

  it("blocks edits once the lock window has passed", () => {
    const session = { markedAt: new Date(Date.now() - 30 * 3600000).toISOString() } as Parameters<typeof isWithinEditWindow>[0];
    expect(isWithinEditWindow(session, 24)).toBe(false);
  });
});
