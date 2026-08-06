import { getSnapshot, setState } from "@/lib/data/store";
import { rooms } from "@/lib/data/seed/academics";
import type { ExamSubject } from "@/lib/types/exams";
import { logExamAudit } from "./exam-audit-service";

export type ScheduleProposalEntry = { examSubjectId: string; date: string; startTime: string; endTime: string; roomId: string; invigilatorId?: string };

/** Deterministic best-effort scheduler: two subjects per section per day, alternating
 * morning/afternoon slots, rooms picked round-robin (labs preferred for practicals). It
 * never touches the store — the caller must review and call applyExamSchedule to commit,
 * so this can never "publish automatically". */
export function proposeExamSchedule(examId: string, onlyUnscheduled = true): ScheduleProposalEntry[] {
  const db = getSnapshot();
  const exam = db.exams.find((e) => e.id === examId);
  if (!exam) return [];

  const subjects = db.examSubjects.filter((s) => s.examId === examId && (!onlyUnscheduled || !s.date));
  const bySection = new Map<string, ExamSubject[]>();
  for (const subject of subjects) bySection.set(subject.sectionId, [...(bySection.get(subject.sectionId) ?? []), subject]);

  const proposals: ScheduleProposalEntry[] = [];
  for (const sectionSubjects of bySection.values()) {
    sectionSubjects.forEach((subject, index) => {
      const dayOffset = Math.floor(index / 2);
      const date = new Date(exam.startDate);
      date.setUTCDate(date.getUTCDate() + dayOffset);
      const isMorning = index % 2 === 0;
      const preferLab = subject.practicalMarks > 0;
      const room = preferLab ? (rooms.find((r) => r.type === "lab") ?? rooms[index % rooms.length]) : rooms[index % rooms.length];
      proposals.push({
        examSubjectId: subject.id,
        date: date.toISOString().slice(0, 10),
        startTime: isMorning ? "09:00" : "11:30",
        endTime: isMorning ? "11:00" : "13:00",
        roomId: room.id,
        invigilatorId: subject.examinerId,
      });
    });
  }
  return proposals;
}

export function applyExamSchedule(examId: string, proposals: ScheduleProposalEntry[], actor: { name: string; role: string }) {
  setState((db) => ({
    ...db,
    examSubjects: db.examSubjects.map((s) => {
      const proposal = proposals.find((p) => p.examSubjectId === s.id);
      return proposal ? { ...s, date: proposal.date, startTime: proposal.startTime, endTime: proposal.endTime, roomId: proposal.roomId, invigilatorId: proposal.invigilatorId } : s;
    }),
  }));
  logExamAudit({ examId, action: "schedule-changed", actorName: actor.name, actorRole: actor.role, summary: `Auto-generated schedule for ${proposals.length} exam subject(s).` });
}

/** Copies only the date/time pattern from one section to another for subjects both sections share — room and invigilator are left for the user to assign so this never silently creates a room-overlap conflict. */
export function copySchedulePattern(examId: string, fromSectionId: string, toSectionId: string) {
  const db = getSnapshot();
  const source = db.examSubjects.filter((s) => s.examId === examId && s.sectionId === fromSectionId);

  setState((current) => ({
    ...current,
    examSubjects: current.examSubjects.map((s) => {
      if (s.examId !== examId || s.sectionId !== toSectionId || s.locked) return s;
      const match = source.find((src) => src.subjectId === s.subjectId);
      return match?.date ? { ...s, date: match.date, startTime: match.startTime, endTime: match.endTime } : s;
    }),
  }));
}
