import { setState } from "@/lib/data/store";
import type { ExamAttendanceRecord, ExamAttendanceStatus } from "@/lib/types/exams";
import { generateId } from "@/lib/utils";
import { logExamAudit } from "./exam-audit-service";

function recordFor(examId: string, examSubjectId: string, studentId: string): ExamAttendanceRecord {
  return { id: generateId("ea"), examId, examSubjectId, studentId, status: "not-marked", locked: false };
}

export function setAttendanceStatus(examId: string, examSubjectId: string, studentId: string, status: ExamAttendanceStatus, actor: { name: string; role: string }, note?: string) {
  setState((db) => {
    const existing = db.examAttendance.find((a) => a.examSubjectId === examSubjectId && a.studentId === studentId);
    if (existing?.locked) return db;
    const base = existing ?? recordFor(examId, examSubjectId, studentId);
    const updated: ExamAttendanceRecord = { ...base, status, note: note ?? base.note, markedBy: actor.name, markedAt: new Date().toISOString() };
    const records = existing ? db.examAttendance.map((a) => (a.id === existing.id ? updated : a)) : [...db.examAttendance, updated];
    return { ...db, examAttendance: records };
  });
}

export function markAllPresent(examId: string, examSubjectId: string, studentIds: string[], actor: { name: string; role: string }) {
  setState((db) => {
    const now = new Date().toISOString();
    const records = [...db.examAttendance];
    for (const studentId of studentIds) {
      const index = records.findIndex((a) => a.examSubjectId === examSubjectId && a.studentId === studentId);
      if (index >= 0) {
        if (records[index].locked) continue;
        records[index] = { ...records[index], status: "present", markedBy: actor.name, markedAt: now };
      } else {
        records.push({ ...recordFor(examId, examSubjectId, studentId), status: "present", markedBy: actor.name, markedAt: now });
      }
    }
    return { ...db, examAttendance: records };
  });
}

export function setAttendanceNote(examSubjectId: string, studentId: string, note: string) {
  setState((db) => ({
    ...db,
    examAttendance: db.examAttendance.map((a) => (a.examSubjectId === examSubjectId && a.studentId === studentId ? { ...a, note } : a)),
  }));
}

export function lockAttendance(examId: string, examSubjectId: string, actor: { name: string; role: string }) {
  setState((db) => ({ ...db, examAttendance: db.examAttendance.map((a) => (a.examSubjectId === examSubjectId ? { ...a, locked: true } : a)) }));
  logExamAudit({ examId, action: "manual-override-used", actorName: actor.name, actorRole: actor.role, summary: "Locked exam attendance for a subject." });
}

export function reopenAttendance(examId: string, examSubjectId: string, reason: string, actor: { name: string; role: string }) {
  setState((db) => ({ ...db, examAttendance: db.examAttendance.map((a) => (a.examSubjectId === examSubjectId ? { ...a, locked: false } : a)) }));
  logExamAudit({ examId, action: "manual-override-used", actorName: actor.name, actorRole: actor.role, summary: "Reopened exam attendance for a subject.", reason });
}
