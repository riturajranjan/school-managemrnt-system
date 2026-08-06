import type { Db } from "@/lib/data/store";
import { roomById, teacherById } from "@/lib/data/seed/academics";
import type { ManagedClass } from "@/lib/types/academics";
import { curriculumCompletionPercent } from "./academics-insights";

export function classTeacherNames(schoolClass: ManagedClass): string[] {
  return [...new Set(schoolClass.sections.map((s) => teacherById(s.classTeacherId)?.name).filter((n): n is string => Boolean(n)))];
}

export function classRoomNames(schoolClass: ManagedClass): string[] {
  return [...new Set(schoolClass.sections.map((s) => roomById(s.roomId)?.name).filter((n): n is string => Boolean(n)))];
}

/** Share of this class's sections that have today's daily attendance marked — null when
 * the class has no sections at all (nothing to measure). */
export function classAttendanceTodayPercent(db: Db, schoolClass: ManagedClass): number | null {
  if (schoolClass.sections.length === 0) return null;
  const today = new Date().toISOString().slice(0, 10);
  const marked = schoolClass.sections.filter((s) => db.attendanceSessions.some((a) => a.sectionId === s.id && a.date.slice(0, 10) === today && a.mode === "daily"));
  return Math.round((marked.length / schoolClass.sections.length) * 100);
}

export function classCurriculumCompletionPercent(db: Db, classId: string): number {
  return curriculumCompletionPercent(db.curriculumUnits.filter((u) => u.classId === classId));
}
