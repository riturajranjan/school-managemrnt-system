import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { detectConflicts, publishTimetable, updateSlot } from "./timetable-service";

describe("detectConflicts", () => {
  beforeEach(() => resetDemoData());

  it("flags a teacher double-booked in the same day and period across two sections", () => {
    const db = getSnapshot();
    const [ttA, ttB] = db.timetables;
    const slotA = ttA.slots.find((s) => s.subjectId);
    const slotB = ttB.slots.find((s) => s.subjectId && s.day === slotA?.day && s.periodIndex === slotA?.periodIndex && s.id !== slotA.id);
    if (!slotA || !slotB) return; // no natural overlap in this seed run — nothing to assert

    updateSlot(ttB.id, slotB.id, { teacherId: slotA.teacherId });

    const conflicts = detectConflicts(getSnapshot());
    const teacherConflict = conflicts.find((c) => c.type === "teacher-double-booking" && c.day === slotA.day && c.periodIndex === slotA.periodIndex);
    expect(teacherConflict).toBeDefined();
  });

  it("flags a room double-booked in the same day and period across two sections", () => {
    const db = getSnapshot();
    const [ttA, ttB] = db.timetables;
    const slotA = ttA.slots.find((s) => s.subjectId);
    const slotB = ttB.slots.find((s) => s.subjectId && s.day === slotA?.day && s.periodIndex === slotA?.periodIndex && s.id !== slotA.id);
    if (!slotA || !slotB) return;

    updateSlot(ttB.id, slotB.id, { roomId: "room-101" });
    updateSlot(ttA.id, slotA.id, { roomId: "room-101" });

    const conflicts = detectConflicts(getSnapshot());
    const roomConflict = conflicts.find((c) => c.type === "room-double-booking" && c.day === slotA.day && c.periodIndex === slotA.periodIndex);
    expect(roomConflict).toBeDefined();
  });

  it("reports no conflicts for a freshly reset (independently seeded) single timetable in isolation", () => {
    const db = getSnapshot();
    const single = { ...db, timetables: [db.timetables[0]] };
    const conflicts = detectConflicts(single);
    expect(conflicts.every((c) => c.type !== "teacher-double-booking" && c.type !== "room-double-booking")).toBe(true);
  });
});

describe("publishTimetable", () => {
  beforeEach(() => resetDemoData());

  it("marks the targeted timetable as published without affecting others", () => {
    const db = getSnapshot();
    const target = db.timetables[0];
    const other = db.timetables[1];

    publishTimetable(target.id);

    expect(getSnapshot().timetables.find((t) => t.id === target.id)?.status).toBe("published");
    expect(getSnapshot().timetables.find((t) => t.id === other.id)?.status).toBe(other.status);
  });
});
