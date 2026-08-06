import { getSnapshot, setState } from "@/lib/data/store";
import type { ExamSubject } from "@/lib/types/exams";
import type { MarksComponentKey, StudentMark } from "@/lib/types/marks";
import { generateId } from "@/lib/utils";
import { logExamAudit } from "./exam-audit-service";

export type MarksComponentPatch = Partial<Record<MarksComponentKey, number | undefined>>;

export function validateComponentValue(value: number, componentMax: number): string[] {
  const errors: string[] = [];
  if (Number.isNaN(value)) return ["Enter a number."];
  if (value < 0) errors.push("Marks can't be negative.");
  if (value > componentMax) errors.push(`Can't exceed ${componentMax}.`);
  if (Math.abs(Math.round(value * 100) - value * 100) > 1e-6) errors.push("Use at most 2 decimal places.");
  return errors;
}

function totalOf(mark: MarksComponentPatch & { graceApplied?: number }): number {
  return (mark.theory ?? 0) + (mark.practical ?? 0) + (mark.internal ?? 0) + (mark.project ?? 0) + (mark.graceApplied ?? 0);
}

export type SaveMarkResult = { ok: true } | { ok: false; errors: string[] };

export function saveMark(examId: string, examSubject: ExamSubject, studentId: string, patch: MarksComponentPatch, actor: { name: string; role: string }): SaveMarkResult {
  const db = getSnapshot();
  const existing = db.studentMarks.find((m) => m.examSubjectId === examSubject.id && m.studentId === studentId);

  const errors: string[] = [];
  const componentMax: Record<MarksComponentKey, number> = { theory: examSubject.theoryMarks, practical: examSubject.practicalMarks, internal: examSubject.internalMarks, project: examSubject.projectMarks };
  for (const key of Object.keys(patch) as MarksComponentKey[]) {
    const value = patch[key];
    if (value === undefined) continue;
    errors.push(...validateComponentValue(value, componentMax[key]));
  }
  if (errors.length > 0) return { ok: false, errors };

  const merged: StudentMark = existing
    ? { ...existing, ...patch }
    : { id: generateId("sm"), examId, examSubjectId: examSubject.id, studentId, graceApplied: 0, ...patch };
  merged.total = totalOf(merged);
  merged.enteredBy = actor.name;
  merged.enteredAt = new Date().toISOString();

  setState((current) => ({
    ...current,
    studentMarks: existing ? current.studentMarks.map((m) => (m.id === existing.id ? merged : m)) : [...current.studentMarks, merged],
  }));

  // Keep the entry session's completion percentage current so the exam detail
  // shell and command centre never show stale progress.
  recomputeSessionProgress(examId, examSubject.id);
  return { ok: true };
}

export function setMarkRemark(examSubjectId: string, studentId: string, remark: string) {
  setState((db) => ({ ...db, studentMarks: db.studentMarks.map((m) => (m.examSubjectId === examSubjectId && m.studentId === studentId ? { ...m, remark } : m)) }));
}

export function bulkFillComponent(examId: string, examSubject: ExamSubject, studentIds: string[], component: MarksComponentKey, value: number, actor: { name: string; role: string }): SaveMarkResult {
  const componentMax: Record<MarksComponentKey, number> = { theory: examSubject.theoryMarks, practical: examSubject.practicalMarks, internal: examSubject.internalMarks, project: examSubject.projectMarks };
  const errors = validateComponentValue(value, componentMax[component]);
  if (errors.length > 0) return { ok: false, errors };

  const db = getSnapshot();
  const attendanceByStudent = new Map(db.examAttendance.filter((a) => a.examSubjectId === examSubject.id).map((a) => [a.studentId, a.status]));

  setState((current) => {
    const marks = [...current.studentMarks];
    for (const studentId of studentIds) {
      if (attendanceByStudent.get(studentId) === "absent") continue;
      const index = marks.findIndex((m) => m.examSubjectId === examSubject.id && m.studentId === studentId);
      if (index >= 0) {
        const updated = { ...marks[index], [component]: value };
        updated.total = totalOf(updated);
        updated.enteredBy = actor.name;
        updated.enteredAt = new Date().toISOString();
        marks[index] = updated;
      } else {
        const created: StudentMark = { id: generateId("sm"), examId, examSubjectId: examSubject.id, studentId, graceApplied: 0, [component]: value, enteredBy: actor.name, enteredAt: new Date().toISOString() };
        created.total = totalOf(created);
        marks.push(created);
      }
    }
    return { ...current, studentMarks: marks };
  });
  recomputeSessionProgress(examId, examSubject.id);
  return { ok: true };
}

function recomputeSessionProgress(examId: string, examSubjectId: string) {
  setState((db) => {
    const roster = db.students.filter((s) => {
      const examSubject = db.examSubjects.find((es) => es.id === examSubjectId);
      return examSubject && s.sectionId === examSubject.sectionId;
    });
    const enteredCount = db.studentMarks.filter((m) => m.examSubjectId === examSubjectId && m.total !== undefined).length;
    const completionPercent = roster.length > 0 ? Math.round((enteredCount / roster.length) * 100) : 0;
    const existingSession = db.marksEntrySessions.find((s) => s.examSubjectId === examSubjectId);
    const now = new Date().toISOString();
    if (existingSession) {
      if (existingSession.status === "locked") return db;
      return {
        ...db,
        marksEntrySessions: db.marksEntrySessions.map((s) =>
          s.examSubjectId === examSubjectId ? { ...s, completionPercent, status: completionPercent > 0 ? "draft" : "not-started", lastSavedAt: now } : s,
        ),
      };
    }
    return {
      ...db,
      marksEntrySessions: [...db.marksEntrySessions, { id: generateId("mes"), examId, examSubjectId, status: "draft", completionPercent, lastSavedAt: now }],
    };
  });
}

export function submitMarksEntry(examId: string, examSubjectId: string, actor: { name: string; role: string }) {
  setState((db) => ({
    ...db,
    marksEntrySessions: db.marksEntrySessions.map((s) => (s.examSubjectId === examSubjectId ? { ...s, status: "submitted", submittedAt: new Date().toISOString(), submittedBy: actor.name } : s)),
  }));
  logExamAudit({ examId, action: "marks-entered", actorName: actor.name, actorRole: actor.role, summary: "Marks entry submitted for verification." });
}

export function lockMarksEntry(examId: string, examSubjectId: string, actor: { name: string; role: string }) {
  setState((db) => ({
    ...db,
    marksEntrySessions: db.marksEntrySessions.map((s) => (s.examSubjectId === examSubjectId ? { ...s, status: "locked", lockedAt: new Date().toISOString(), lockedBy: actor.name } : s)),
  }));
  logExamAudit({ examId, action: "marks-modified", actorName: actor.name, actorRole: actor.role, summary: "Marks entry locked." });
}

export function reopenMarksEntry(examId: string, examSubjectId: string, reason: string, actor: { name: string; role: string }) {
  setState((db) => ({
    ...db,
    marksEntrySessions: db.marksEntrySessions.map((s) => (s.examSubjectId === examSubjectId ? { ...s, status: "draft", reopenedAt: new Date().toISOString(), reopenedBy: actor.name, reopenReason: reason } : s)),
  }));
  logExamAudit({ examId, action: "manual-override-used", actorName: actor.name, actorRole: actor.role, summary: "Marks entry reopened for correction.", reason });
}
