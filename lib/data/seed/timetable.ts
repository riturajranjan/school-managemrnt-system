import type { Timetable, TimetableSlot, WeekDay } from "@/lib/types/timetable";
import { periodDefinitions, weekDays } from "@/lib/types/timetable";
import { CURRENT_SESSION, schoolClasses } from "./reference";
import { assignmentsForSection, rooms } from "./academics";
import { seededHelpers } from "./rng";

const helpers = seededHelpers(24092026);
const { int, daysAgoIso } = helpers;

const teachingPeriods = periodDefinitions.filter((p) => !p.isBreak).map((p) => p.index);

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = int(0, i);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const timetables: Timetable[] = [];

let sectionCounter = 0;
for (const schoolClass of schoolClasses) {
  for (const section of schoolClass.sections) {
    sectionCounter += 1;
    const homeroomId = rooms[sectionCounter % (rooms.length - 3)].id; // keep labs/hall mostly for their own subjects
    const assignments = assignmentsForSection(section.id);

    const occurrences = assignments.flatMap((a) => Array.from({ length: a.weeklyPeriods }, () => a));
    const slotPool: { day: WeekDay; periodIndex: number }[] = [];
    for (const day of weekDays) {
      for (const periodIndex of teachingPeriods) slotPool.push({ day, periodIndex });
    }
    const shuffledOccurrences = shuffle(occurrences);
    const shuffledSlots = shuffle(slotPool);

    const slots: TimetableSlot[] = shuffledSlots.map((slot, index) => {
      const assignment = shuffledOccurrences[index];
      return {
        id: `${section.id}-${slot.day}-${slot.periodIndex}`,
        day: slot.day,
        periodIndex: slot.periodIndex,
        subjectId: assignment?.subjectId,
        teacherId: assignment?.primaryTeacherId,
        roomId: assignment?.roomId ?? (assignment ? homeroomId : undefined),
        locked: false,
      };
    });

    timetables.push({
      id: `tt-${section.id}`,
      session: CURRENT_SESSION,
      branchId: "main",
      classId: schoolClass.id,
      sectionId: section.id,
      effectiveFrom: daysAgoIso(45),
      status: "published",
      updatedAt: daysAgoIso(int(1, 20)),
      slots,
    });
  }
}

export function timetableForSection(sectionId: string): Timetable | undefined {
  return timetables.find((t) => t.sectionId === sectionId);
}
