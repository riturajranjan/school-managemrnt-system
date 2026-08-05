import { getSnapshot, setState, type Db } from "@/lib/data/store";
import type { Subject, SubjectAssignment } from "@/lib/types/academics";
import { generateId } from "@/lib/utils";

export function createSubject(data: Omit<Subject, "id" | "status">): Subject {
  const subject: Subject = { ...data, id: generateId("subject"), status: "active" };
  setState((db) => ({ ...db, subjects: [...db.subjects, subject] }));
  return subject;
}

export function updateSubject(subjectId: string, patch: Partial<Subject>) {
  setState((db) => ({ ...db, subjects: db.subjects.map((s) => (s.id === subjectId ? { ...s, ...patch } : s)) }));
}

export function setSubjectStatus(subjectId: string, status: Subject["status"]) {
  updateSubject(subjectId, { status });
}

export type AssignmentValidationResult = { valid: boolean; errors: string[] };

export function validateAssignment(
  input: Omit<SubjectAssignment, "id">,
  db: Db,
  gradeOrder: number,
  excludeAssignmentId?: string,
): AssignmentValidationResult {
  const errors: string[] = [];
  const subject = db.subjects.find((s) => s.id === input.subjectId);

  if (!subject) {
    errors.push("Select a valid subject.");
    return { valid: false, errors };
  }

  if (gradeOrder < subject.gradeRangeStart || gradeOrder > subject.gradeRangeEnd) {
    errors.push(`${subject.name} is only offered for grades ${subject.gradeRangeStart}–${subject.gradeRangeEnd}.`);
  }

  const duplicate = db.subjectAssignments.some(
    (a) => a.id !== excludeAssignmentId && a.subjectId === input.subjectId && a.sectionId === input.sectionId,
  );
  if (duplicate) {
    errors.push("This subject is already assigned to this section.");
  }

  const teacherLoad = db.subjectAssignments
    .filter((a) => a.id !== excludeAssignmentId && a.primaryTeacherId === input.primaryTeacherId)
    .reduce((sum, a) => sum + a.weeklyPeriods, 0);
  const teacher = db.teachers.find((t) => t.id === input.primaryTeacherId);
  if (teacher && teacherLoad + input.weeklyPeriods > teacher.maxWeeklyPeriods) {
    errors.push(`${teacher.name} would exceed their maximum weekly periods (${teacher.maxWeeklyPeriods}).`);
  }

  if (input.weeklyPeriods < 1 || input.weeklyPeriods > 10) {
    errors.push("Weekly periods must be between 1 and 10.");
  }

  if (subject.type === "practical" && !input.roomId) {
    errors.push(`${subject.name} requires a laboratory to be assigned.`);
  }

  return { valid: errors.length === 0, errors };
}

export function createAssignment(input: Omit<SubjectAssignment, "id">, gradeOrder: number): { assignment: SubjectAssignment } | { errors: string[] } {
  const db = getSnapshot();
  const result = validateAssignment(input, db, gradeOrder);
  if (!result.valid) return { errors: result.errors };

  const assignment: SubjectAssignment = { ...input, id: generateId("sa") };
  setState((current) => ({ ...current, subjectAssignments: [...current.subjectAssignments, assignment] }));
  return { assignment };
}

export function removeAssignment(assignmentId: string) {
  setState((db) => ({ ...db, subjectAssignments: db.subjectAssignments.filter((a) => a.id !== assignmentId) }));
}
