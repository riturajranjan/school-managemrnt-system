import type { Db } from "@/lib/data/store";

export type ReportCardReadiness = {
  templateConfigured: boolean;
  activeTemplateName?: string;
  eligibleExamCount: number;
  calculatedResultCount: number;
  eligibleStudentCount: number;
  missingRemarksCount: number;
  blockingIssues: string[];
};

/** Pure summary of whether report cards can actually be generated right now, and
 * what's blocking it — used to replace four permanently-empty metric cards with
 * something that explains the gap instead of just showing zero. */
export function computeReportCardReadiness(db: Db): ReportCardReadiness {
  const activeTemplate = db.reportCardTemplates.find((t) => t.status === "active") ?? db.reportCardTemplates[0];
  const examIdsWithResults = new Set(db.examResults.map((r) => r.examId));
  const eligibleStudentIds = new Set(db.examResults.map((r) => r.studentId));
  const missingRemarksCount = db.examResults.filter((r) => !db.teacherRemarks.some((tr) => tr.examId === r.examId && tr.studentId === r.studentId)).length;

  const blockingIssues: string[] = [];
  if (db.reportCardTemplates.length === 0) blockingIssues.push("No report card template has been created yet.");
  else if (!db.reportCardTemplates.some((t) => t.status === "active")) blockingIssues.push("No template is marked active — activate one before generating.");
  if (examIdsWithResults.size === 0) blockingIssues.push("No exam has calculated results yet — results must be processed first.");

  return {
    templateConfigured: Boolean(activeTemplate),
    activeTemplateName: activeTemplate?.name,
    eligibleExamCount: examIdsWithResults.size,
    calculatedResultCount: db.examResults.length,
    eligibleStudentCount: eligibleStudentIds.size,
    missingRemarksCount,
    blockingIssues,
  };
}
