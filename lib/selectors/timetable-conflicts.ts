import type { Db } from "@/lib/data/store";
import { periodDefinitions } from "@/lib/types/timetable";
import type { Timetable, TimetableConflict, TimetableSlot, WeekDay } from "@/lib/types/timetable";

const teachingPeriods = periodDefinitions.filter((p) => !p.isBreak).map((p) => p.index);

export type ConflictSummary = {
  total: number;
  teacherOverlaps: number;
  roomConflicts: number;
  schedulingIssues: number;
};

export function summarizeConflicts(conflicts: TimetableConflict[]): ConflictSummary {
  return {
    total: conflicts.length,
    teacherOverlaps: conflicts.filter((c) => c.type === "teacher-double-booking").length,
    roomConflicts: conflicts.filter((c) => c.type === "room-double-booking").length,
    schedulingIssues: conflicts.filter((c) => c.type !== "teacher-double-booking" && c.type !== "room-double-booking").length,
  };
}

export type ConflictSlotContext = {
  timetable: Timetable;
  slot: TimetableSlot;
  className: string;
  subjectName?: string;
  teacherName?: string;
  roomName?: string;
};

/** Resolves every slot referenced by a conflict back to its timetable + readable names, for the detail drawer. */
export function getConflictSlotContexts(db: Db, conflict: TimetableConflict): ConflictSlotContext[] {
  const contexts: ConflictSlotContext[] = [];
  for (const timetable of db.timetables) {
    for (const slot of timetable.slots) {
      if (!conflict.slotIds.includes(slot.id)) continue;
      const schoolClass = db.classes.find((c) => c.id === timetable.classId);
      const section = schoolClass?.sections.find((s) => s.id === timetable.sectionId);
      contexts.push({
        timetable,
        slot,
        className: schoolClass && section ? `${schoolClass.name} — ${section.name}` : timetable.sectionId,
        subjectName: db.subjects.find((s) => s.id === slot.subjectId)?.name,
        teacherName: db.teachers.find((t) => t.id === slot.teacherId)?.name,
        roomName: db.rooms.find((r) => r.id === slot.roomId)?.name,
      });
    }
  }
  return contexts;
}

export function conflictReason(conflict: TimetableConflict, contexts: ConflictSlotContext[]): string {
  const period = periodDefinitions.find((p) => p.index === conflict.periodIndex);
  const when = `${conflict.day}, ${period?.label ?? `period ${conflict.periodIndex}`} (${period?.startTime}–${period?.endTime})`;
  if (conflict.type === "teacher-double-booking") {
    const teacher = contexts[0]?.teacherName ?? "This teacher";
    const classNames = contexts.map((c) => c.className).join(" and ");
    return `${teacher} is timetabled for ${classNames} at the same time — ${when}.`;
  }
  if (conflict.type === "room-double-booking") {
    const room = contexts[0]?.roomName ?? "This room";
    const classNames = contexts.map((c) => c.className).join(" and ");
    return `${room} is booked for ${classNames} at the same time — ${when}.`;
  }
  if (conflict.type === "consecutive-period-limit") {
    return `${contexts[0]?.subjectName ?? "The same subject"} runs for more than 2 consecutive periods on ${conflict.day} for ${contexts[0]?.className ?? "this class"}.`;
  }
  return conflict.description;
}

function isTeacherFree(db: Db, teacherId: string, day: WeekDay, periodIndex: number): boolean {
  return !db.timetables.some((t) => t.slots.some((s) => s.day === day && s.periodIndex === periodIndex && s.teacherId === teacherId));
}

function isRoomFree(db: Db, roomId: string, day: WeekDay, periodIndex: number): boolean {
  return !db.timetables.some((t) => t.slots.some((s) => s.day === day && s.periodIndex === periodIndex && s.roomId === roomId));
}

/** Teachers free at this day/period, subject-qualified ones first. */
export function getAvailableTeachers(db: Db, day: WeekDay, periodIndex: number, subjectId?: string) {
  const free = db.teachers.filter((t) => t.status === "active" && isTeacherFree(db, t.id, day, periodIndex));
  if (!subjectId) return free;
  return [...free].sort((a, b) => Number(b.subjectIds.includes(subjectId)) - Number(a.subjectIds.includes(subjectId)));
}

/** Rooms free at this day/period, matching room type preferred first. */
export function getAvailableRooms(db: Db, day: WeekDay, periodIndex: number, preferType?: string) {
  const free = db.rooms.filter((r) => isRoomFree(db, r.id, day, periodIndex));
  if (!preferType) return free;
  return [...free].sort((a, b) => Number(b.type === preferType) - Number(a.type === preferType));
}

export type AlternativePeriod = { day: WeekDay; periodIndex: number; label: string };

/** Free periods for this same section, across the week, where the slot's current teacher and room are also free. */
export function getAlternativePeriods(db: Db, timetable: Timetable, slot: TimetableSlot, weekDaysList: readonly WeekDay[]): AlternativePeriod[] {
  const results: AlternativePeriod[] = [];
  for (const day of weekDaysList) {
    for (const periodIndex of teachingPeriods) {
      if (day === slot.day && periodIndex === slot.periodIndex) continue;
      const occupied = timetable.slots.find((s) => s.day === day && s.periodIndex === periodIndex && s.subjectId);
      if (occupied) continue;
      if (slot.teacherId && !isTeacherFree(db, slot.teacherId, day, periodIndex)) continue;
      if (slot.roomId && !isRoomFree(db, slot.roomId, day, periodIndex)) continue;
      const period = periodDefinitions.find((p) => p.index === periodIndex);
      results.push({ day, periodIndex, label: `${day.slice(0, 3)} · ${period?.label ?? periodIndex}` });
    }
  }
  return results.slice(0, 6);
}

export type SuggestedResolution =
  | { kind: "move-room"; slotId: string; timetableId: string; roomId: string; roomName: string }
  | { kind: "move-period"; slotId: string; timetableId: string; day: WeekDay; periodIndex: number; label: string }
  | { kind: "reassign-teacher"; slotId: string; timetableId: string; teacherId: string; teacherName: string }
  | { kind: "none" };

/** A single best-guess fix per conflict, offered as a one-click "Apply resolution" action — never applied automatically. */
export function suggestResolution(db: Db, conflict: TimetableConflict, weekDaysList: readonly WeekDay[]): SuggestedResolution {
  const contexts = getConflictSlotContexts(db, conflict);
  if (contexts.length === 0) return { kind: "none" };
  const [primary, secondary] = contexts;
  const target = secondary ?? primary;

  if (conflict.type === "room-double-booking") {
    const subject = db.subjects.find((s) => s.id === target.slot.subjectId);
    const room = getAvailableRooms(db, conflict.day, conflict.periodIndex, subject?.type === "practical" ? "lab" : "classroom")[0];
    if (room) return { kind: "move-room", slotId: target.slot.id, timetableId: target.timetable.id, roomId: room.id, roomName: room.name };
  }

  if (conflict.type === "teacher-double-booking") {
    const alternative = getAlternativePeriods(db, target.timetable, target.slot, weekDaysList)[0];
    if (alternative) {
      return { kind: "move-period", slotId: target.slot.id, timetableId: target.timetable.id, day: alternative.day, periodIndex: alternative.periodIndex, label: alternative.label };
    }
    const subject = db.subjects.find((s) => s.id === target.slot.subjectId);
    const teacher = getAvailableTeachers(db, conflict.day, conflict.periodIndex, subject?.id)[0];
    if (teacher) return { kind: "reassign-teacher", slotId: target.slot.id, timetableId: target.timetable.id, teacherId: teacher.id, teacherName: teacher.name };
  }

  return { kind: "none" };
}

/** Room-double-booking conflicts only — reassigning a room never changes who teaches or when, so it's the one conflict type safe to fix without a human decision. */
export function isSafeToAutoResolve(conflict: TimetableConflict): boolean {
  return conflict.type === "room-double-booking";
}
