// Pure, side-effect-free transforms over a `TimetableSlot[]` working copy —
// mirrors the mutating functions in timetable-service.ts but never touches
// the store. The editing page uses these against a local draft so edits are
// genuinely "unsaved" until saveProposedTimetable() commits them.
import type { TimetableSlot, WeekDay } from "@/lib/types/timetable";

export function opUpdateSlot(slots: TimetableSlot[], slotId: string, patch: Partial<TimetableSlot>): TimetableSlot[] {
  return slots.map((s) => (s.id === slotId ? { ...s, ...patch } : s));
}

export function opClearSlot(slots: TimetableSlot[], slotId: string): TimetableSlot[] {
  return opUpdateSlot(slots, slotId, { subjectId: undefined, teacherId: undefined, roomId: undefined, note: undefined, slotType: "class" });
}

export function opToggleLock(slots: TimetableSlot[], slotId: string): TimetableSlot[] {
  return slots.map((s) => (s.id === slotId ? { ...s, locked: !s.locked } : s));
}

export function opSetBreak(slots: TimetableSlot[], slotId: string, isBreak: boolean): TimetableSlot[] {
  return opUpdateSlot(slots, slotId, isBreak ? { slotType: "break", subjectId: undefined, teacherId: undefined, roomId: undefined } : { slotType: "class" });
}

export function opCopyDay(slots: TimetableSlot[], fromDay: WeekDay, toDay: WeekDay): TimetableSlot[] {
  const source = slots.filter((s) => s.day === fromDay);
  return slots.map((slot) => {
    if (slot.day !== toDay || slot.locked) return slot;
    const match = source.find((s) => s.periodIndex === slot.periodIndex);
    return match ? { ...slot, subjectId: match.subjectId, teacherId: match.teacherId, roomId: match.roomId, slotType: match.slotType } : slot;
  });
}

export function opMovePeriod(slots: TimetableSlot[], slotId: string, targetDay: WeekDay, targetPeriodIndex: number): TimetableSlot[] {
  const source = slots.find((s) => s.id === slotId);
  if (!source) return slots;
  return slots.map((s) => {
    if (s.id === slotId) return { ...s, subjectId: undefined, teacherId: undefined, roomId: undefined, slotType: "class" };
    if (s.day === targetDay && s.periodIndex === targetPeriodIndex) {
      return { ...s, subjectId: source.subjectId, teacherId: source.teacherId, roomId: source.roomId, slotType: source.slotType };
    }
    return s;
  });
}

export function opCopyPeriod(slots: TimetableSlot[], fromSlotId: string, toSlotId: string): TimetableSlot[] {
  const source = slots.find((s) => s.id === fromSlotId);
  if (!source) return slots;
  return slots.map((s) => (s.id === toSlotId && !s.locked ? { ...s, subjectId: source.subjectId, teacherId: source.teacherId, roomId: source.roomId } : s));
}

export function slotsAreEqual(a: TimetableSlot[], b: TimetableSlot[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}
