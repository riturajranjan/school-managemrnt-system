import type { Db } from "@/lib/data/store";
import { computeExamReadiness } from "./exam-insights";
import type { Exam } from "@/lib/types/exams";

export type PipelineStageKey = "marks" | "verification" | "calculation" | "review" | "reportCards" | "publication";

export type PipelineStage = { key: PipelineStageKey; label: string; status: "complete" | "in-progress" | "not-started" | "blocked" };

export type ExamPipelineRow = {
  exam: Exam;
  className: string;
  marksPercent: number;
  verificationPercent: number;
  resultCount: number;
  resultsCalculated: boolean;
  reportCardCount: number;
  publicationStatus: "not-published" | "scheduled" | "published" | "revoked";
  blockingIssue?: string;
  inconsistencies: string[];
  primaryAction: { label: string; href: string };
  stages: PipelineStage[];
};

/** Combines exam readiness with publication + report-card state into one row-shaped
 * summary, plus a defensive pass for combinations that should be structurally
 * impossible through the normal UI (e.g. published with zero results) but are worth
 * surfacing rather than silently trusting if the data ever gets there another way. */
export function computeExamPipelineRow(db: Db, exam: Exam, className: string): ExamPipelineRow {
  const readiness = computeExamReadiness(db, exam.id);
  const publication = db.resultPublications.find((p) => p.examId === exam.id);
  const resultCount = db.examResults.filter((r) => r.examId === exam.id).length;
  const reportCardCount = db.reportCards.filter((rc) => rc.examId === exam.id && (rc.status === "generated" || rc.status === "published")).length;
  const publicationStatus: ExamPipelineRow["publicationStatus"] = publication?.status ?? "not-published";

  const inconsistencies: string[] = [];
  if ((exam.status === "published" || publicationStatus === "published") && resultCount === 0) {
    inconsistencies.push("Marked published but has zero calculated results.");
  }
  if (reportCardCount > 0 && resultCount === 0) {
    inconsistencies.push("Report cards exist without any calculated result.");
  }
  if (publicationStatus === "published" && reportCardCount === 0) {
    inconsistencies.push("Published without any generated report card.");
  }

  let blockingIssue: string | undefined;
  let primaryAction: ExamPipelineRow["primaryAction"];
  if (readiness.subjectCount === 0) {
    blockingIssue = "No subjects configured";
    primaryAction = { label: "Configure subjects", href: `/exams/${exam.id}/subjects` };
  } else if (readiness.scheduleComplete !== "complete") {
    blockingIssue = "Schedule incomplete";
    primaryAction = { label: "Finish scheduling", href: `/exams/${exam.id}/schedule` };
  } else if (readiness.marksEntryComplete !== "complete") {
    blockingIssue = "Marks entry incomplete";
    primaryAction = { label: "Enter marks", href: `/exams/${exam.id}/marks` };
  } else if (readiness.verificationComplete !== "complete") {
    blockingIssue = "Verification pending";
    primaryAction = { label: "Review verification", href: "/marks/verification" };
  } else if (!readiness.resultsCalculated) {
    blockingIssue = undefined;
    primaryAction = { label: "Calculate results", href: `/exams/${exam.id}/results` };
  } else if (reportCardCount === 0) {
    primaryAction = { label: "Generate report cards", href: "/report-cards/generate" };
  } else if (publicationStatus !== "published") {
    primaryAction = { label: "Publish", href: `/exams/${exam.id}/publish` };
  } else {
    primaryAction = { label: "View results", href: `/exams/${exam.id}/results` };
  }

  const stageStatus = (done: boolean, started: boolean): PipelineStage["status"] => (done ? "complete" : started ? "in-progress" : "not-started");

  const stages: PipelineStage[] = [
    { key: "marks", label: "Marks", status: stageStatus(readiness.marksEntryComplete === "complete", readiness.marksEntryPercent > 0) },
    { key: "verification", label: "Verification", status: stageStatus(readiness.verificationComplete === "complete", readiness.verificationPercent > 0) },
    { key: "calculation", label: "Calculation", status: stageStatus(readiness.resultsCalculated, false) },
    { key: "review", label: "Review", status: stageStatus(readiness.resultsCalculated && inconsistencies.length === 0, readiness.resultsCalculated) },
    { key: "reportCards", label: "Report Cards", status: stageStatus(readiness.reportCardsGenerated === "complete", reportCardCount > 0) },
    { key: "publication", label: "Publication", status: stageStatus(publicationStatus === "published", publicationStatus === "scheduled") },
  ];

  return { exam, className, marksPercent: readiness.marksEntryPercent, verificationPercent: readiness.verificationPercent, resultCount, resultsCalculated: readiness.resultsCalculated, reportCardCount, publicationStatus, blockingIssue, inconsistencies, primaryAction, stages };
}
