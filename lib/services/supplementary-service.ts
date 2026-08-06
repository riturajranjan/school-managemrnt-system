import { getSnapshot, setState } from "@/lib/data/store";
import type { Exam, ExamClass, ExamSubject, SupplementaryReason } from "@/lib/types/exams";
import type { ResultVersion, StudentResult, SubjectResult } from "@/lib/types/results";
import { gradeForPercent } from "./result-engine";
import { generateId } from "@/lib/utils";
import { logExamAudit } from "./exam-audit-service";

export type EligibleStudent = { studentId: string; classId: string; sectionId: string; failedSubjectIds: string[] };

/** Students whose original result needs a re-take — pure selector, no side effects. */
export function getEligibleStudentsForReExam(originalExamId: string): EligibleStudent[] {
  const db = getSnapshot();
  return db.examResults
    .filter((r) => r.examId === originalExamId && (r.status === "fail" || r.status === "re-exam-required" || r.status === "withheld"))
    .map((r) => ({
      studentId: r.studentId,
      classId: r.classId,
      sectionId: r.sectionId,
      failedSubjectIds: r.subjectResults.filter((sr) => sr.status === "fail" || sr.status === "withheld").map((sr) => sr.subjectId),
    }))
    .filter((e) => e.failedSubjectIds.length > 0);
}

export function createSupplementaryExam(
  originalExamId: string,
  reason: SupplementaryReason,
  selected: EligibleStudent[],
  dates: { startDate: string; endDate: string },
  actor: { name: string; role: string },
): Exam | null {
  const db = getSnapshot();
  const original = db.exams.find((e) => e.id === originalExamId);
  if (!original || selected.length === 0) return null;

  const now = new Date().toISOString();
  const exam: Exam = {
    id: generateId("exam"),
    name: `${original.name} — Supplementary`,
    code: `${original.code}-SUPP`,
    type: "custom",
    session: original.session,
    branchId: original.branchId,
    term: original.term,
    description: `Re-examination linked to "${original.name}" for students requiring a re-take.`,
    startDate: dates.startDate,
    endDate: dates.endDate,
    status: "draft",
    scope: original.scope,
    mode: original.mode,
    classIds: [...new Set(selected.map((s) => s.classId))],
    gradingSchemeId: original.gradingSchemeId,
    resultRuleId: original.resultRuleId,
    reportCardTemplateId: original.reportCardTemplateId,
    parentExamId: originalExamId,
    supplementaryReason: reason,
    notifyOnPublish: original.notifyOnPublish,
    createdBy: actor.name,
    createdAt: now,
    updatedAt: now,
  };

  const examClasses: ExamClass[] = [];
  const examSubjects: ExamSubject[] = [];
  const bySection = new Map<string, EligibleStudent[]>();
  for (const student of selected) bySection.set(student.sectionId, [...(bySection.get(student.sectionId) ?? []), student]);

  for (const [sectionId, sectionStudents] of bySection) {
    const classId = sectionStudents[0].classId;
    const allSectionStudentIds = db.students.filter((s) => s.sectionId === sectionId).map((s) => s.id);
    const eligibleIds = new Set(sectionStudents.map((s) => s.studentId));
    examClasses.push({ id: generateId("ec"), examId: exam.id, classId, sectionId, excludedStudentIds: allSectionStudentIds.filter((id) => !eligibleIds.has(id)) });

    const subjectIds = new Set(sectionStudents.flatMap((s) => s.failedSubjectIds));
    const originalSubjects = db.examSubjects.filter((s) => s.examId === originalExamId && s.sectionId === sectionId);
    for (const subjectId of subjectIds) {
      const source = originalSubjects.find((s) => s.subjectId === subjectId);
      if (!source) continue;
      examSubjects.push({
        ...source,
        id: generateId("es"),
        examId: exam.id,
        date: undefined,
        startTime: undefined,
        endTime: undefined,
        roomId: undefined,
        invigilatorId: undefined,
        locked: false,
      });
    }
  }

  setState((db2) => ({ ...db2, exams: [...db2.exams, exam], examClasses: [...db2.examClasses, ...examClasses], examSubjects: [...db2.examSubjects, ...examSubjects] }));
  logExamAudit({ examId: exam.id, action: "exam-created", actorName: actor.name, actorRole: actor.role, summary: `Created supplementary exam "${exam.name}" for ${selected.length} student(s), linked to "${original.name}".` });
  return exam;
}

/** Merges a supplementary exam's per-subject results back into the original exam's
 * result — only the retaken subjects are replaced, everything else is preserved
 * unchanged. The original StudentResult is archived to ResultVersion first, so the
 * pre-retake history is never lost. */
export function applySupplementaryResults(supplementaryExamId: string, actor: { name: string; role: string }): { updated: number } {
  const db = getSnapshot();
  const supExam = db.exams.find((e) => e.id === supplementaryExamId);
  if (!supExam?.parentExamId) return { updated: 0 };
  const originalExamId = supExam.parentExamId;
  const scheme = db.gradingSchemes.find((g) => g.id === (db.exams.find((e) => e.id === originalExamId)?.gradingSchemeId));
  const rule = db.resultRules.find((r) => r.id === (db.exams.find((e) => e.id === originalExamId)?.resultRuleId));
  const supResults = db.examResults.filter((r) => r.examId === supplementaryExamId);

  const updatedResults: StudentResult[] = [];
  const archivedVersions: ResultVersion[] = [];
  const now = new Date().toISOString();

  for (const supResult of supResults) {
    const original = db.examResults.find((r) => r.examId === originalExamId && r.studentId === supResult.studentId);
    if (!original) continue;

    const retaken = new Map(supResult.subjectResults.map((sr) => [sr.subjectId, sr]));
    const mergedSubjectResults: SubjectResult[] = original.subjectResults.map((sr) => retaken.get(sr.subjectId) ?? sr);
    const countable = mergedSubjectResults.filter((s) => s.status !== "exempted");
    const totalObtained = countable.reduce((sum, s) => sum + s.total, 0);
    const totalMax = countable.reduce((sum, s) => sum + s.maxMarks, 0);
    const percent = totalMax > 0 ? Math.round((totalObtained / totalMax) * 1000) / 10 : 0;
    const failedSubjectCount = mergedSubjectResults.filter((s) => s.status === "fail").length;
    const status = failedSubjectCount > (rule?.maxFailedSubjects ?? 0) ? "fail" : "pass";
    const grade = scheme ? (gradeForPercent(scheme.ranges, percent)?.name ?? original.grade) : original.grade;

    archivedVersions.push({ id: generateId("rv"), examId: originalExamId, studentId: original.studentId, version: original.calculationVersion, snapshot: original, reason: `Superseded by supplementary exam "${supExam.name}"`, createdBy: actor.name, createdAt: now });
    updatedResults.push({
      ...original,
      subjectResults: mergedSubjectResults,
      totalObtained,
      totalMax,
      percent,
      grade,
      status,
      failedSubjectCount,
      calculationVersion: original.calculationVersion + 1,
      calculatedAt: now,
      explanation: [...original.explanation, `Revised via supplementary exam "${supExam.name}" — ${retaken.size} subject(s) retaken.`],
    });
  }

  setState((current) => ({
    ...current,
    examResults: [...current.examResults.filter((r) => !(r.examId === originalExamId && updatedResults.some((u) => u.studentId === r.studentId))), ...updatedResults],
    resultVersions: [...current.resultVersions, ...archivedVersions],
  }));

  logExamAudit({ examId: originalExamId, action: "result-recalculated", actorName: actor.name, actorRole: actor.role, summary: `Applied supplementary exam "${supExam.name}" results for ${updatedResults.length} student(s).` });
  return { updated: updatedResults.length };
}
