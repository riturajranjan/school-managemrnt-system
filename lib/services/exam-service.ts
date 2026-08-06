import { getSnapshot, setState } from "@/lib/data/store";
import type { Exam, ExamClass, ExamStatus } from "@/lib/types/exams";
import { generateId } from "@/lib/utils";
import { logExamAudit } from "./exam-audit-service";

export type ExamInput = Omit<Exam, "id" | "status" | "createdAt" | "updatedAt">;

export function createExam(data: ExamInput, actor: { name: string; role: string }): Exam {
  const now = new Date().toISOString();
  const exam: Exam = { ...data, id: generateId("exam"), status: "draft", createdAt: now, updatedAt: now };
  setState((db) => ({ ...db, exams: [...db.exams, exam] }));
  logExamAudit({ examId: exam.id, action: "exam-created", actorName: actor.name, actorRole: actor.role, summary: `Created exam "${exam.name}" (${exam.code}).` });
  return exam;
}

export function updateExam(examId: string, patch: Partial<Omit<Exam, "id">>) {
  setState((db) => ({ ...db, exams: db.exams.map((e) => (e.id === examId ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e)) }));
}

export function setExamStatus(examId: string, status: ExamStatus, actor: { name: string; role: string }) {
  const db = getSnapshot();
  const exam = db.exams.find((e) => e.id === examId);
  if (!exam) return;
  updateExam(examId, { status });
  logExamAudit({ examId, action: "schedule-changed", actorName: actor.name, actorRole: actor.role, summary: `Exam status changed from "${exam.status}" to "${status}".`, previousValue: exam.status, newValue: status });
}

/** Deleting is only allowed while an exam is still a draft with no subjects configured yet — anything further along has real dependent data. */
export function deleteExam(examId: string): { ok: true } | { ok: false; error: string } {
  const db = getSnapshot();
  const exam = db.exams.find((e) => e.id === examId);
  if (!exam) return { ok: false, error: "Exam not found." };
  if (exam.status !== "draft") return { ok: false, error: "Only a draft exam can be deleted. Cancel it instead." };
  if (db.examSubjects.some((s) => s.examId === examId)) return { ok: false, error: "Remove the exam's subjects before deleting it." };
  setState((current) => ({ ...current, exams: current.exams.filter((e) => e.id !== examId) }));
  return { ok: true };
}

/** Rebuilds ExamClass rows for the given class+section pairs, preserving any existing exclusion list for pairs that remain. */
export function setExamClasses(examId: string, pairs: { classId: string; sectionId: string }[]) {
  setState((db) => {
    const existing = db.examClasses.filter((c) => c.examId === examId);
    const next: ExamClass[] = pairs.map((pair) => {
      const found = existing.find((c) => c.classId === pair.classId && c.sectionId === pair.sectionId);
      return found ?? { id: generateId("ec"), examId, classId: pair.classId, sectionId: pair.sectionId, excludedStudentIds: [] };
    });
    return { ...db, examClasses: [...db.examClasses.filter((c) => c.examId !== examId), ...next] };
  });
}

export function toggleStudentExclusion(examClassId: string, studentId: string) {
  setState((db) => ({
    ...db,
    examClasses: db.examClasses.map((c) =>
      c.id === examClassId
        ? { ...c, excludedStudentIds: c.excludedStudentIds.includes(studentId) ? c.excludedStudentIds.filter((id) => id !== studentId) : [...c.excludedStudentIds, studentId] }
        : c,
    ),
  }));
}
