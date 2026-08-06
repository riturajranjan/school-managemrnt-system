import { getSnapshot, setState, type Db } from "@/lib/data/store";
import type { ExamSubject } from "@/lib/types/exams";
import { calculateExamResults } from "./result-engine";
import { generateId } from "@/lib/utils";
import { logExamAudit } from "./exam-audit-service";

export type ResultCalculationError = { message: string };

export function checkResultCalculationConfig(db: Db, examId: string): ResultCalculationError[] {
  const errors: ResultCalculationError[] = [];
  const exam = db.exams.find((e) => e.id === examId);
  if (!exam) return [{ message: "Exam not found." }];
  if (!exam.gradingSchemeId) errors.push({ message: "No grading scheme is assigned to this exam." });
  if (!exam.resultRuleId) errors.push({ message: "No result rule is assigned to this exam." });
  const scheme = db.gradingSchemes.find((g) => g.id === exam.gradingSchemeId);
  if (exam.gradingSchemeId && !scheme) errors.push({ message: "The assigned grading scheme no longer exists." });
  if (scheme && scheme.ranges.length === 0) errors.push({ message: "The assigned grading scheme has no grade bands configured." });
  const rule = db.resultRules.find((r) => r.id === exam.resultRuleId);
  if (exam.resultRuleId && !rule) errors.push({ message: "The assigned result rule no longer exists." });
  const subjects = db.examSubjects.filter((s) => s.examId === examId);
  if (subjects.length === 0) errors.push({ message: "No subjects are configured for this exam." });
  const missingMarks = subjects.filter((s) => {
    const roster = db.students.filter((st) => st.sectionId === s.sectionId);
    const attended = roster.filter((st) => {
      const att = db.examAttendance.find((a) => a.examSubjectId === s.id && a.studentId === st.id);
      return att && att.status !== "absent" && att.status !== "exempted";
    });
    return attended.some((st) => !db.studentMarks.find((m) => m.examSubjectId === s.id && m.studentId === st.id));
  });
  if (missingMarks.length > 0) errors.push({ message: `${missingMarks.length} subject(s) still have missing marks for present students.` });
  return errors;
}

export function calculateResults(examId: string, actor: { name: string; role: string }): { ok: true; count: number } | { ok: false; errors: ResultCalculationError[] } {
  const db = getSnapshot();
  const exam = db.exams.find((e) => e.id === examId);
  if (!exam) return { ok: false, errors: [{ message: "Exam not found." }] };

  const errors = checkResultCalculationConfig(db, examId);
  if (errors.length > 0) return { ok: false, errors };

  const scheme = db.gradingSchemes.find((g) => g.id === exam.gradingSchemeId)!;
  const rule = db.resultRules.find((r) => r.id === exam.resultRuleId)!;
  const examSubjects = db.examSubjects.filter((s) => s.examId === examId);
  const sectionIds = new Set(examSubjects.map((s) => s.sectionId));
  const examStudents = db.students.filter((s) => sectionIds.has(s.sectionId));

  const examSubjectsByClassSection = new Map<string, ExamSubject[]>();
  const marksByStudent = new Map<string, typeof db.studentMarks>();
  const attendanceByStudent = new Map<string, typeof db.examAttendance>();
  for (const student of examStudents) {
    const key = `${student.classId}::${student.sectionId}`;
    if (!examSubjectsByClassSection.has(key)) examSubjectsByClassSection.set(key, examSubjects.filter((s) => s.sectionId === student.sectionId));
    marksByStudent.set(student.id, db.studentMarks.filter((m) => m.examId === examId && m.studentId === student.id));
    attendanceByStudent.set(student.id, db.examAttendance.filter((a) => a.examId === examId && a.studentId === student.id));
  }

  const previousResults = db.examResults.filter((r) => r.examId === examId);
  const nextVersion = (previousResults[0]?.calculationVersion ?? 0) + 1;
  const isRecalculation = previousResults.length > 0;

  const newResults = calculateExamResults({
    examId,
    students: examStudents.map((s) => ({ id: s.id, classId: s.classId, sectionId: s.sectionId, name: `${s.profile.firstName} ${s.profile.lastName}` })),
    examSubjectsByClassSection,
    marksByStudent,
    attendanceByStudent,
    gradingScheme: scheme,
    resultRule: rule,
    calculationVersion: nextVersion,
  });

  setState((current) => {
    const archivedVersions = isRecalculation
      ? previousResults.map((r) => ({ id: generateId("rv"), examId, studentId: r.studentId, version: r.calculationVersion, snapshot: r, reason: "Superseded by recalculation", createdBy: actor.name, createdAt: new Date().toISOString() }))
      : [];
    return {
      ...current,
      examResults: [...current.examResults.filter((r) => r.examId !== examId), ...newResults],
      resultVersions: [...current.resultVersions, ...archivedVersions],
      exams: current.exams.map((e) => (e.id === examId ? { ...e, status: "result-ready", updatedAt: new Date().toISOString() } : e)),
    };
  });

  logExamAudit({
    examId,
    action: isRecalculation ? "result-recalculated" : "result-calculated",
    actorName: actor.name,
    actorRole: actor.role,
    summary: `${isRecalculation ? "Recalculated" : "Calculated"} results for ${newResults.length} student(s) (version ${nextVersion}).`,
  });

  return { ok: true, count: newResults.length };
}
