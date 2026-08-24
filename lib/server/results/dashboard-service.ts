// Results hub aggregation. Composes the real Phase 8A-8D services — never a
// second result/marks calculation engine. One row per exam that has reached
// the results stage (anything past "draft" — a draft exam has no schedule to
// show progress against). marksPercent/verificationPercent are aggregated
// from the real per-paper marks summary; reportCardCount is not a separate
// generation step (Phase 8D has no ReportCard model) — it's just studentCount
// once published. No fabricated "blocking issue"/"inconsistency" text.
import type { OrgScope } from "@/lib/server/api/scope";
import type { ResultsDashboardDto, ResultsPipelineRowDto, ResultsPipelineStageDto } from "@/lib/api/contracts";
import { listExams } from "@/lib/server/exams/service";
import { listMarksSummary } from "@/lib/server/exams/marks-service";
import { getExamResults } from "@/lib/server/results/service";

function stageStatus(percent: number): "complete" | "in-progress" | "not-started" {
  if (percent >= 100) return "complete";
  if (percent > 0) return "in-progress";
  return "not-started";
}

export async function getResultsDashboard(scope: OrgScope): Promise<ResultsDashboardDto> {
  const exams = (await listExams(scope)).filter((e) => e.status !== "draft");

  const rows = await Promise.all(
    exams.map(async (exam): Promise<ResultsPipelineRowDto> => {
      const [papers, results] = await Promise.all([
        listMarksSummary(scope, { examId: exam.id }),
        getExamResults(scope, exam.id),
      ]);

      const totalStudentSlots = papers.reduce((sum, p) => sum + p.totalStudents, 0);
      const enteredSlots = papers.reduce((sum, p) => sum + p.enteredCount, 0);
      const marksPercent = totalStudentSlots > 0 ? Math.round((enteredSlots / totalStudentSlots) * 100) : 0;
      const verifiedPapers = papers.filter((p) => p.sheetStatus === "verified").length;
      const verificationPercent = papers.length > 0 ? Math.round((verifiedPapers / papers.length) * 100) : 0;
      const className = [...new Set(papers.map((p) => p.section.className))].join(", ") || "No classes";
      const reportCardCount = results.published ? results.studentCount : 0;

      const stages: ResultsPipelineStageDto[] = [
        { key: "marks", label: "Marks", status: stageStatus(marksPercent) },
        { key: "verification", label: "Verification", status: stageStatus(verificationPercent) },
        { key: "results", label: "Results", status: results.studentCount > 0 && results.incompleteCount === 0 ? "complete" : results.studentCount > 0 ? "in-progress" : "not-started" },
        { key: "publication", label: "Publication", status: results.published ? "complete" : "not-started" },
      ];

      let primaryAction: ResultsPipelineRowDto["primaryAction"];
      if (marksPercent < 100) primaryAction = { label: "Enter marks", href: `/exams/${exam.id}/marks` };
      else if (verificationPercent < 100) primaryAction = { label: "Verify marks", href: `/exams/${exam.id}/marks` };
      else if (!results.published) primaryAction = { label: "Publish results", href: `/exams/${exam.id}/publish` };
      else primaryAction = { label: "View results", href: `/exams/${exam.id}/results` };

      return {
        examId: exam.id, examName: exam.name, examCode: exam.code, examStatus: exam.status,
        startsOn: exam.startsOn, endsOn: exam.endsOn, className,
        marksPercent, verificationPercent, studentCount: results.studentCount, incompleteCount: results.incompleteCount,
        reportCardCount, published: results.published, publishedAt: results.publishedAt,
        stages, primaryAction,
      };
    }),
  );

  rows.sort((a, b) => (a.startsOn < b.startsOn ? 1 : -1));
  return { rows };
}
