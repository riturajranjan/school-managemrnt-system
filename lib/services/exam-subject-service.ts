import { getSnapshot, setState } from "@/lib/data/store";
import type { ExamSubject } from "@/lib/types/exams";
import { generateId } from "@/lib/utils";
import { logExamAudit } from "./exam-audit-service";

export type ExamSubjectValidation = { valid: boolean; errors: string[] };

export function validateExamSubject(input: Pick<ExamSubject, "maxMarks" | "passingMarks" | "theoryMarks" | "practicalMarks" | "internalMarks" | "projectMarks" | "graceMarksLimit">): string[] {
  const errors: string[] = [];
  if (input.maxMarks <= 0) errors.push("Maximum marks must be greater than 0.");
  if (input.passingMarks < 0) errors.push("Passing marks can't be negative.");
  if (input.passingMarks > input.maxMarks) errors.push("Passing marks can't exceed the maximum marks.");
  const componentTotal = input.theoryMarks + input.practicalMarks + input.internalMarks + input.projectMarks;
  if (componentTotal !== input.maxMarks) errors.push(`Theory + practical + internal + project (${componentTotal}) must add up to the maximum marks (${input.maxMarks}).`);
  if (input.graceMarksLimit < 0) errors.push("Grace-mark limit can't be negative.");
  return errors;
}

export function addExamSubject(
  examId: string,
  classId: string,
  sectionId: string,
  subjectId: string,
  defaults: { maxMarks: number; passingMarks: number; theoryMarks: number; practicalMarks: number },
): { subject: ExamSubject } | { errors: string[] } {
  const db = getSnapshot();
  const duplicate = db.examSubjects.some((s) => s.examId === examId && s.sectionId === sectionId && s.subjectId === subjectId);
  if (duplicate) return { errors: ["This subject is already configured for this section."] };

  const subject: ExamSubject = {
    id: generateId("es"),
    examId,
    classId,
    sectionId,
    subjectId,
    maxMarks: defaults.maxMarks,
    passingMarks: defaults.passingMarks,
    theoryMarks: defaults.theoryMarks,
    practicalMarks: defaults.practicalMarks,
    internalMarks: 0,
    projectMarks: 0,
    graceMarksLimit: 5,
    weightage: 100,
    locked: false,
  };
  setState((current) => ({ ...current, examSubjects: [...current.examSubjects, subject] }));
  return { subject };
}

export function updateExamSubject(examSubjectId: string, patch: Partial<Omit<ExamSubject, "id" | "examId">>): ExamSubjectValidation {
  const db = getSnapshot();
  const existing = db.examSubjects.find((s) => s.id === examSubjectId);
  if (!existing) return { valid: false, errors: ["Exam subject not found."] };
  if (existing.locked) return { valid: false, errors: ["This subject's configuration is locked."] };

  const merged = { ...existing, ...patch };
  const errors = validateExamSubject(merged);
  if (errors.length > 0) return { valid: false, errors };

  setState((current) => ({ ...current, examSubjects: current.examSubjects.map((s) => (s.id === examSubjectId ? merged : s)) }));
  return { valid: true, errors: [] };
}

export function removeExamSubject(examSubjectId: string): { ok: true } | { ok: false; error: string } {
  const db = getSnapshot();
  const existing = db.examSubjects.find((s) => s.id === examSubjectId);
  if (!existing) return { ok: false, error: "Exam subject not found." };
  if (db.studentMarks.some((m) => m.examSubjectId === examSubjectId)) return { ok: false, error: "Marks have already been entered for this subject — remove them first." };
  setState((current) => ({ ...current, examSubjects: current.examSubjects.filter((s) => s.id !== examSubjectId) }));
  return { ok: true };
}

export function toggleExamSubjectLock(examSubjectId: string, actor: { name: string; role: string }) {
  const db = getSnapshot();
  const existing = db.examSubjects.find((s) => s.id === examSubjectId);
  if (!existing) return;
  setState((current) => ({ ...current, examSubjects: current.examSubjects.map((s) => (s.id === examSubjectId ? { ...s, locked: !s.locked } : s)) }));
  logExamAudit({ examId: existing.examId, action: "manual-override-used", actorName: actor.name, actorRole: actor.role, summary: `${existing.locked ? "Unlocked" : "Locked"} subject configuration.` });
}
