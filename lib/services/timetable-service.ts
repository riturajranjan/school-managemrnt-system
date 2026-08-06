import { getSnapshot, setState, type Db } from "@/lib/data/store";
import { assignmentsForSection } from "@/lib/data/seed/academics";
import { isSafeToAutoResolve, suggestResolution, type SuggestedResolution } from "@/lib/selectors/timetable-conflicts";
import { periodDefinitions, weekDays, type DismissedConflict, type Timetable, type TimetableConflict, type TimetableSlot, type WeekDay } from "@/lib/types/timetable";
import { generateId } from "@/lib/utils";

const teachingPeriods = periodDefinitions.filter((p) => !p.isBreak).map((p) => p.index);
const MAX_CONSECUTIVE_SAME_SUBJECT = 2;

export function updateSlot(timetableId: string, slotId: string, patch: Partial<TimetableSlot>) {
  setState((db) => ({
    ...db,
    timetables: db.timetables.map((t) =>
      t.id === timetableId ? { ...t, updatedAt: new Date().toISOString(), slots: t.slots.map((s) => (s.id === slotId ? { ...s, ...patch } : s)) } : t,
    ),
  }));
}

export function clearSlot(timetableId: string, slotId: string) {
  updateSlot(timetableId, slotId, { subjectId: undefined, teacherId: undefined, roomId: undefined, note: undefined });
}

export function toggleSlotLock(timetableId: string, slotId: string) {
  setState((db) => ({
    ...db,
    timetables: db.timetables.map((t) =>
      t.id === timetableId ? { ...t, slots: t.slots.map((s) => (s.id === slotId ? { ...s, locked: !s.locked } : s)) } : t,
    ),
  }));
}

export function copyDay(timetableId: string, fromDay: WeekDay, toDay: WeekDay) {
  setState((db) => ({
    ...db,
    timetables: db.timetables.map((t) => {
      if (t.id !== timetableId) return t;
      const source = t.slots.filter((s) => s.day === fromDay);
      const slots = t.slots.map((slot) => {
        if (slot.day !== toDay || slot.locked) return slot;
        const match = source.find((s) => s.periodIndex === slot.periodIndex);
        return match ? { ...slot, subjectId: match.subjectId, teacherId: match.teacherId, roomId: match.roomId } : slot;
      });
      return { ...t, updatedAt: new Date().toISOString(), slots };
    }),
  }));
}

export function publishTimetable(timetableId: string) {
  setState((db) => ({ ...db, timetables: db.timetables.map((t) => (t.id === timetableId ? { ...t, status: "published" } : t)) }));
}

/** Scans every published timetable for teacher/room double-bookings and subject-load violations. */
export function detectConflicts(db: Db): TimetableConflict[] {
  const conflicts: TimetableConflict[] = [];

  for (const day of weekDays) {
    for (const periodIndex of teachingPeriods) {
      const slotsHere = db.timetables.flatMap((t) => t.slots.filter((s) => s.day === day && s.periodIndex === periodIndex).map((s) => ({ t, s })));

      const byTeacher = new Map<string, { t: Timetable; s: TimetableSlot }[]>();
      const byRoom = new Map<string, { t: Timetable; s: TimetableSlot }[]>();
      for (const entry of slotsHere) {
        if (entry.s.teacherId) byTeacher.set(entry.s.teacherId, [...(byTeacher.get(entry.s.teacherId) ?? []), entry]);
        if (entry.s.roomId) byRoom.set(entry.s.roomId, [...(byRoom.get(entry.s.roomId) ?? []), entry]);
      }

      for (const [teacherId, entries] of byTeacher) {
        if (entries.length > 1) {
          const teacherName = db.teachers.find((t) => t.id === teacherId)?.name ?? teacherId;
          conflicts.push({
            id: `conflict-teacher-${teacherId}-${day}-${periodIndex}`,
            type: "teacher-double-booking",
            description: `${teacherName} is scheduled in ${entries.length} sections at once`,
            day,
            periodIndex,
            slotIds: entries.map((e) => e.s.id),
            severity: "error",
          });
        }
      }

      for (const [roomId, entries] of byRoom) {
        if (entries.length > 1) {
          const roomName = db.rooms.find((r) => r.id === roomId)?.name ?? roomId;
          conflicts.push({
            id: `conflict-room-${roomId}-${day}-${periodIndex}`,
            type: "room-double-booking",
            description: `${roomName} is double-booked`,
            day,
            periodIndex,
            slotIds: entries.map((e) => e.s.id),
            severity: "error",
          });
        }
      }
    }
  }

  // Consecutive-period limit: same subject running more than MAX_CONSECUTIVE_SAME_SUBJECT periods in a row for one section on one day.
  for (const timetable of db.timetables) {
    for (const day of weekDays) {
      const daySlots = timetable.slots.filter((s) => s.day === day).sort((a, b) => a.periodIndex - b.periodIndex);
      let run: TimetableSlot[] = [];
      const flushRun = () => {
        if (run.length > MAX_CONSECUTIVE_SAME_SUBJECT) {
          conflicts.push({
            id: `conflict-consecutive-${timetable.id}-${day}-${run[0].periodIndex}`,
            type: "consecutive-period-limit",
            description: `Same subject runs for ${run.length} consecutive periods`,
            day,
            periodIndex: run[0].periodIndex,
            slotIds: run.map((s) => s.id),
            severity: "warning",
          });
        }
        run = [];
      };
      for (const slot of daySlots) {
        if (run.length > 0 && run[run.length - 1].subjectId === slot.subjectId && slot.subjectId) {
          run.push(slot);
        } else {
          flushRun();
          if (slot.subjectId) run = [slot];
        }
      }
      flushRun();
    }
  }

  return conflicts;
}

export type ProposedTimetable = {
  slots: TimetableSlot[];
  conflictCount: number;
  workloadBySection: number;
};

function shuffleWith<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let s = seed;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Mocked "AI" regenerate: redistributes this section's subject occurrences
 * across the week, keeping any locked slots fixed. Deterministic (seeded by
 * a version counter) so "Regenerate" produces a different-but-reproducible
 * layout each click, without calling an external model. Never writes to the
 * store — the result is a draft the user must review and publish.
 */
export function proposeTimetable(sectionId: string, version = 1): ProposedTimetable {
  const db = getSnapshot();
  const current = db.timetables.find((t) => t.sectionId === sectionId);
  const assignments = assignmentsForSection(sectionId);
  const lockedSlots = current?.slots.filter((s) => s.locked) ?? [];
  const lockedKeys = new Set(lockedSlots.map((s) => `${s.day}-${s.periodIndex}`));

  const occurrences = assignments.flatMap((a) => Array.from({ length: a.weeklyPeriods }, () => a));
  const openSlots: { day: WeekDay; periodIndex: number }[] = [];
  for (const day of weekDays) {
    for (const periodIndex of teachingPeriods) {
      if (!lockedKeys.has(`${day}-${periodIndex}`)) openSlots.push({ day, periodIndex });
    }
  }

  const shuffledOccurrences = shuffleWith(occurrences, 1000 + version * 97);
  const shuffledSlots = shuffleWith(openSlots, 2000 + version * 53);

  const generatedSlots: TimetableSlot[] = shuffledSlots.map((slot, index) => {
    const assignment = shuffledOccurrences[index];
    return {
      id: `${sectionId}-${slot.day}-${slot.periodIndex}`,
      day: slot.day,
      periodIndex: slot.periodIndex,
      subjectId: assignment?.subjectId,
      teacherId: assignment?.primaryTeacherId,
      roomId: assignment?.roomId,
      locked: false,
    };
  });

  const slots = [...lockedSlots, ...generatedSlots];

  const proposalDb: Db = { ...db, timetables: db.timetables.map((t) => (t.sectionId === sectionId ? { ...t, slots } : t)) };
  const conflictCount = detectConflicts(proposalDb).filter((c) => c.day && slots.some((s) => c.slotIds.includes(s.id))).length;

  return { slots, conflictCount, workloadBySection: slots.filter((s) => s.subjectId).length };
}

export function saveProposedTimetable(timetableId: string, slots: TimetableSlot[]) {
  setState((db) => ({ ...db, timetables: db.timetables.map((t) => (t.id === timetableId ? { ...t, slots, updatedAt: new Date().toISOString() } : t)) }));
}

/** Moves a slot's assignment to a different (currently free) day/period, clearing the source. */
export function movePeriod(timetableId: string, slotId: string, targetDay: WeekDay, targetPeriodIndex: number) {
  setState((db) => ({
    ...db,
    timetables: db.timetables.map((t) => {
      if (t.id !== timetableId) return t;
      const source = t.slots.find((s) => s.id === slotId);
      if (!source) return t;
      return {
        ...t,
        updatedAt: new Date().toISOString(),
        slots: t.slots.map((s) => {
          if (s.id === slotId) return { ...s, subjectId: undefined, teacherId: undefined, roomId: undefined, slotType: "class" };
          if (s.day === targetDay && s.periodIndex === targetPeriodIndex) {
            return { ...s, subjectId: source.subjectId, teacherId: source.teacherId, roomId: source.roomId, slotType: source.slotType };
          }
          return s;
        }),
      };
    }),
  }));
}

/** Copies a slot's assignment onto another slot without clearing the source (locked targets are left untouched). */
export function copyPeriod(timetableId: string, fromSlotId: string, toSlotId: string) {
  setState((db) => ({
    ...db,
    timetables: db.timetables.map((t) => {
      if (t.id !== timetableId) return t;
      const source = t.slots.find((s) => s.id === fromSlotId);
      if (!source) return t;
      return {
        ...t,
        updatedAt: new Date().toISOString(),
        slots: t.slots.map((s) => (s.id === toSlotId && !s.locked ? { ...s, subjectId: source.subjectId, teacherId: source.teacherId, roomId: source.roomId } : s)),
      };
    }),
  }));
}

export function setSlotBreak(timetableId: string, slotId: string, isBreak: boolean) {
  updateSlot(timetableId, slotId, isBreak ? { slotType: "break", subjectId: undefined, teacherId: undefined, roomId: undefined } : { slotType: "class" });
}

/** Applies a single suggested fix from suggestResolution() — the only place resolutions actually mutate the store. */
export function applyResolution(resolution: SuggestedResolution) {
  if (resolution.kind === "move-room") {
    updateSlot(resolution.timetableId, resolution.slotId, { roomId: resolution.roomId });
  } else if (resolution.kind === "move-period") {
    movePeriod(resolution.timetableId, resolution.slotId, resolution.day, resolution.periodIndex);
  } else if (resolution.kind === "reassign-teacher") {
    updateSlot(resolution.timetableId, resolution.slotId, { teacherId: resolution.teacherId });
  }
}

export function dismissConflict(conflictId: string, reason: string, dismissedBy: string) {
  const entry: DismissedConflict = { id: generateId("dismiss"), conflictId, reason, dismissedBy, dismissedAt: new Date().toISOString() };
  setState((db) => ({ ...db, dismissedConflicts: [entry, ...db.dismissedConflicts.filter((d) => d.conflictId !== conflictId)] }));
}

export function undismissConflict(conflictId: string) {
  setState((db) => ({ ...db, dismissedConflicts: db.dismissedConflicts.filter((d) => d.conflictId !== conflictId) }));
}

/** Clears dismissal records whose underlying conflict no longer occurs — housekeeping for the "Dismiss resolved" action. */
export function pruneResolvedDismissals(activeConflictIds: Set<string>) {
  setState((db) => ({ ...db, dismissedConflicts: db.dismissedConflicts.filter((d) => activeConflictIds.has(d.conflictId)) }));
}

/** Fixes every room-double-booking conflict by moving one side to a free, type-matched room — the only conflict type it's safe to change without a human decision (see isSafeToAutoResolve). */
export function autoResolveSafeConflicts(conflicts: TimetableConflict[], weekDaysList: readonly WeekDay[]): number {
  let resolvedCount = 0;
  setState((db) => {
    let next = db;
    for (const conflict of conflicts) {
      if (!isSafeToAutoResolve(conflict)) continue;
      // Re-derive the suggestion against the latest `next` so earlier fixes in this same pass are accounted for.
      const resolution = suggestResolution(next, conflict, weekDaysList);
      if (resolution.kind === "move-room") {
        next = {
          ...next,
          timetables: next.timetables.map((t) =>
            t.id === resolution.timetableId
              ? { ...t, updatedAt: new Date().toISOString(), slots: t.slots.map((s) => (s.id === resolution.slotId ? { ...s, roomId: resolution.roomId } : s)) }
              : t,
          ),
        };
        resolvedCount += 1;
      }
    }
    return next;
  });
  return resolvedCount;
}

export function createTimetableIfMissing(classId: string, sectionId: string, session: string, branchId: string): Timetable {
  const db = getSnapshot();
  const existing = db.timetables.find((t) => t.sectionId === sectionId);
  if (existing) return existing;
  const timetable: Timetable = {
    id: generateId("tt"),
    session,
    branchId,
    classId,
    sectionId,
    effectiveFrom: new Date().toISOString(),
    status: "draft",
    updatedAt: new Date().toISOString(),
    slots: [],
  };
  setState((current) => ({ ...current, timetables: [...current.timetables, timetable] }));
  return timetable;
}
