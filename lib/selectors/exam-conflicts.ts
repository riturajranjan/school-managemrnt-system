import type { Db } from "@/lib/data/store";
import type { ExamConflict, ExamSubject } from "@/lib/types/exams";
import { generateId } from "@/lib/utils";

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function overlaps(a: ExamSubject, b: ExamSubject): boolean {
  if (!a.date || !b.date || a.date !== b.date || !a.startTime || !a.endTime || !b.startTime || !b.endTime) return false;
  return toMinutes(a.startTime) < toMinutes(b.endTime) && toMinutes(b.startTime) < toMinutes(a.endTime);
}

const SCHOOL_START = "08:00";
const SCHOOL_END = "17:00";
const MIN_GAP_MINUTES = 30;

/** Scans every scheduled exam subject across all exams — mirrors the timetable module's
 * global detectConflicts(db) pattern so a teacher double-booked between two concurrently
 * running exams is still caught, not just conflicts within a single exam. */
export function detectExamConflicts(db: Db): ExamConflict[] {
  const conflicts: ExamConflict[] = [];
  const scheduled = db.examSubjects.filter((s) => s.date && s.startTime && s.endTime);

  for (let i = 0; i < scheduled.length; i++) {
    for (let j = i + 1; j < scheduled.length; j++) {
      const a = scheduled[i];
      const b = scheduled[j];
      if (!overlaps(a, b)) continue;

      if (a.sectionId === b.sectionId) {
        conflicts.push({
          id: generateId("ec"),
          type: "student-overlap",
          description: "This section has two exams scheduled at overlapping times.",
          examSubjectIds: [a.id, b.id],
          severity: "error",
        });
      }
      if (a.examinerId && a.examinerId === b.examinerId) {
        conflicts.push({
          id: generateId("ec"),
          type: "teacher-overlap",
          description: "The same teacher is the examiner of record for two overlapping exams.",
          examSubjectIds: [a.id, b.id],
          severity: "warning",
        });
      }
      if (a.invigilatorId && a.invigilatorId === b.invigilatorId) {
        conflicts.push({
          id: generateId("ec"),
          type: "invigilator-overlap",
          description: "The same invigilator is assigned to two overlapping exams.",
          examSubjectIds: [a.id, b.id],
          severity: "error",
        });
      }
      if (a.roomId && a.roomId === b.roomId) {
        conflicts.push({
          id: generateId("ec"),
          type: "room-overlap",
          description: "This room is booked for two overlapping exams.",
          examSubjectIds: [a.id, b.id],
          severity: "error",
        });
      }
    }
  }

  // Room capacity — enough seats for the section actually sitting the exam.
  for (const subject of scheduled) {
    if (!subject.roomId) continue;
    const room = db.rooms.find((r) => r.id === subject.roomId);
    if (!room) continue;
    const examClass = db.examClasses.find((c) => c.examId === subject.examId && c.sectionId === subject.sectionId);
    const section = db.classes.flatMap((c) => c.sections).find((s) => s.id === subject.sectionId);
    const eligible = Math.max(0, (section?.enrolledCount ?? 0) - (examClass?.excludedStudentIds.length ?? 0));
    if (eligible > room.capacity) {
      conflicts.push({
        id: generateId("ec"),
        type: "room-capacity",
        description: `${room.name} seats ${room.capacity}, but ${eligible} students are eligible for this exam.`,
        examSubjectIds: [subject.id],
        severity: "warning",
      });
    }
  }

  // Insufficient gap — same section, same day, back-to-back-but-not-quite subjects.
  const bySection = new Map<string, ExamSubject[]>();
  for (const subject of scheduled) {
    const key = `${subject.sectionId}::${subject.date}`;
    bySection.set(key, [...(bySection.get(key) ?? []), subject]);
  }
  for (const group of bySection.values()) {
    const sorted = [...group].sort((a, b) => toMinutes(a.startTime!) - toMinutes(b.startTime!));
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = toMinutes(sorted[i + 1].startTime!) - toMinutes(sorted[i].endTime!);
      if (gap >= 0 && gap < MIN_GAP_MINUTES) {
        conflicts.push({
          id: generateId("ec"),
          type: "insufficient-gap",
          description: `Only ${gap} minute(s) between these two exams — below the recommended ${MIN_GAP_MINUTES}-minute gap.`,
          examSubjectIds: [sorted[i].id, sorted[i + 1].id],
          severity: "warning",
        });
      }
    }
  }

  // Outside school hours.
  for (const subject of scheduled) {
    if (subject.startTime! < SCHOOL_START || subject.endTime! > SCHOOL_END) {
      conflicts.push({
        id: generateId("ec"),
        type: "outside-school-hours",
        description: `Scheduled ${subject.startTime}–${subject.endTime}, outside school hours (${SCHOOL_START}–${SCHOOL_END}).`,
        examSubjectIds: [subject.id],
        severity: "warning",
      });
    }
  }

  // Holiday conflict.
  const holidayDates = new Set(db.academicEvents.filter((e) => e.type === "holiday").map((e) => e.startDate.slice(0, 10)));
  for (const subject of scheduled) {
    if (subject.date && holidayDates.has(subject.date)) {
      conflicts.push({
        id: generateId("ec"),
        type: "holiday-conflict",
        description: "This exam is scheduled on a declared holiday.",
        examSubjectIds: [subject.id],
        severity: "error",
      });
    }
  }

  return conflicts;
}

export type ExamConflictSummary = { total: number; errors: number; warnings: number };

export function summarizeExamConflicts(conflicts: ExamConflict[]): ExamConflictSummary {
  return { total: conflicts.length, errors: conflicts.filter((c) => c.severity === "error").length, warnings: conflicts.filter((c) => c.severity === "warning").length };
}
