import type { Db } from "@/lib/data/store";
import type { PulseFactor } from "@/components/dashboard/data/types";
import { detectExamConflicts } from "./exam-conflicts";
import { checkResultCalculationConfig } from "@/lib/services/result-processing-service";

const ACTIVE_STATUSES = ["scheduled", "in-progress", "marks-entry", "verification", "result-processing"] as const;

export function computeExamPulseFactors(db: Db): PulseFactor[] {
  const activeExams = db.exams.filter((e) => (ACTIVE_STATUSES as readonly string[]).includes(e.status) || e.status === "result-ready");
  const activeExamIds = new Set(activeExams.map((e) => e.id));
  const subjects = db.examSubjects.filter((s) => activeExamIds.has(s.examId));

  const scheduledCount = subjects.filter((s) => s.date && s.roomId).length;
  const schedulePercent = subjects.length > 0 ? Math.round((scheduledCount / subjects.length) * 100) : 100;

  const sessions = db.marksEntrySessions.filter((s) => activeExamIds.has(s.examId));
  const marksPercent = sessions.length > 0 ? Math.round(sessions.reduce((sum, s) => sum + s.completionPercent, 0) / sessions.length) : 0;

  const verifications = db.marksVerifications.filter((v) => activeExamIds.has(v.examId));
  const verifiedCount = verifications.filter((v) => v.status === "verified" || v.status === "approved" || v.status === "locked").length;
  const verificationPercent = verifications.length > 0 ? Math.round((verifiedCount / verifications.length) * 100) : 0;

  const reachedResultsStage = activeExams.filter((e) => e.status === "result-processing" || e.status === "result-ready");
  const withResults = reachedResultsStage.filter((e) => db.examResults.some((r) => r.examId === e.id));
  const resultReadinessPercent = reachedResultsStage.length > 0 ? Math.round((withResults.length / reachedResultsStage.length) * 100) : 100;

  const resultsCount = db.examResults.filter((r) => activeExamIds.has(r.examId)).length;
  const reportCardsGenerated = db.reportCards.filter((rc) => activeExamIds.has(rc.examId) && (rc.status === "generated" || rc.status === "published")).length;
  const reportCardPercent = resultsCount > 0 ? Math.round((reportCardsGenerated / resultsCount) * 100) : 100;

  const resultReadyExams = activeExams.filter((e) => e.status === "result-ready");
  const publishedCount = db.resultPublications.filter((p) => resultReadyExams.some((e) => e.id === p.examId) && p.status === "published").length;
  const publicationPercent = resultReadyExams.length > 0 ? Math.round((publishedCount / resultReadyExams.length) * 100) : 100;

  const tone = (percent: number) => (percent >= 80 ? ("success" as const) : percent >= 50 ? ("warning" as const) : ("error" as const));

  return [
    { key: "schedule", label: "Schedule completion", score: schedulePercent, displayValue: `${schedulePercent}%`, tone: tone(schedulePercent) },
    { key: "marksEntry", label: "Marks-entry progress", score: marksPercent, displayValue: `${marksPercent}%`, tone: tone(marksPercent) },
    { key: "verification", label: "Verification progress", score: verificationPercent, displayValue: `${verificationPercent}%`, tone: tone(verificationPercent) },
    { key: "results", label: "Result-generation readiness", score: resultReadinessPercent, displayValue: `${resultReadinessPercent}%`, tone: tone(resultReadinessPercent) },
    { key: "reportCards", label: "Report-card readiness", score: reportCardPercent, displayValue: `${reportCardPercent}%`, tone: tone(reportCardPercent) },
    { key: "publication", label: "Publication status", score: publicationPercent, displayValue: `${publicationPercent}%`, tone: tone(publicationPercent) },
  ];
}

export type ExamExceptionItem = { id: string; title: string; detail: string; severity: "critical" | "warning"; href?: string };

export function computeExamExceptionFeed(db: Db): ExamExceptionItem[] {
  const items: ExamExceptionItem[] = [];
  const activeExams = db.exams.filter((e) => e.status !== "draft" && e.status !== "archived" && e.status !== "cancelled");

  const missingSubjects = activeExams.filter((e) => e.classIds.length > 0 && !db.examSubjects.some((s) => s.examId === e.id));
  if (missingSubjects.length > 0) {
    items.push({ id: "missing-subjects", title: "Missing exam subjects", detail: `${missingSubjects.length} exam(s) have classes selected but no subjects configured.`, severity: "critical" });
  }

  const unassignedTeacher = db.examSubjects.filter((s) => {
    const exam = db.exams.find((e) => e.id === s.examId);
    return exam && exam.status !== "draft" && s.date && !s.markEntryTeacherId;
  });
  if (unassignedTeacher.length > 0) {
    items.push({ id: "teacher-unassigned", title: "Teacher not assigned", detail: `${unassignedTeacher.length} scheduled subject(s) have no mark-entry teacher assigned.`, severity: "warning" });
  }

  const conflicts = detectExamConflicts(db);
  const roomConflicts = conflicts.filter((c) => c.type === "room-overlap" || c.type === "room-capacity");
  if (roomConflicts.length > 0) {
    items.push({ id: "room-conflicts", title: "Room conflicts", detail: `${roomConflicts.length} room overlap or capacity issue(s) detected.`, severity: "critical" });
  }
  const otherConflicts = conflicts.filter((c) => c.type !== "room-overlap" && c.type !== "room-capacity" && c.severity === "error");
  if (otherConflicts.length > 0) {
    items.push({ id: "schedule-conflicts", title: "Schedule conflicts", detail: `${otherConflicts.length} other scheduling conflict(s) need review.`, severity: "critical" });
  }

  const today = new Date().toISOString().slice(0, 10);
  const overdueEntry = db.examSubjects.filter((s) => {
    const exam = db.exams.find((e) => e.id === s.examId);
    if (!exam || !s.date || s.date >= today) return false;
    const session = db.marksEntrySessions.find((ms) => ms.examSubjectId === s.id);
    return !session || session.status === "not-started";
  });
  if (overdueEntry.length > 0) {
    items.push({ id: "marks-not-entered", title: "Marks not entered", detail: `${overdueEntry.length} subject(s) past their exam date still have no marks entered.`, severity: "critical", href: "/marks" });
  }

  const aboveMax = db.studentMarks.filter((m) => {
    const subject = db.examSubjects.find((s) => s.id === m.examSubjectId);
    if (!subject) return false;
    return (m.theory ?? 0) > subject.theoryMarks || (m.practical ?? 0) > subject.practicalMarks || (m.internal ?? 0) > subject.internalMarks || (m.project ?? 0) > subject.projectMarks;
  });
  if (aboveMax.length > 0) {
    items.push({ id: "marks-above-max", title: "Marks above maximum", detail: `${aboveMax.length} entered mark(s) exceed their component's maximum.`, severity: "critical" });
  }

  const pendingVerification = db.marksVerifications.filter((v) => v.status === "submitted");
  if (pendingVerification.length > 0) {
    items.push({ id: "verification-pending", title: "Verification pending", detail: `${pendingVerification.length} subject(s) submitted and awaiting verification.`, severity: "warning", href: "/marks/verification" });
  }

  const calcErrorExams = activeExams.filter((e) => (e.status === "verification" || e.status === "result-processing" || e.status === "result-ready") && checkResultCalculationConfig(db, e.id).length > 0);
  if (calcErrorExams.length > 0) {
    items.push({ id: "calc-errors", title: "Result calculation errors", detail: `${calcErrorExams.length} exam(s) have configuration issues blocking result calculation.`, severity: "critical" });
  }

  const failedReportCards = db.reportCards.filter((rc) => rc.status === "failed");
  if (failedReportCards.length > 0) {
    items.push({ id: "report-card-failures", title: "Report card generation failures", detail: `${failedReportCards.length} report card(s) failed to generate.`, severity: "warning", href: "/report-cards" });
  }

  const resultReadyUnpublished = activeExams.filter((e) => e.status === "result-ready" && !db.resultPublications.some((p) => p.examId === e.id && p.status === "published"));
  if (resultReadyUnpublished.length > 0) {
    items.push({ id: "publication-blocked", title: "Ready to publish", detail: `${resultReadyUnpublished.length} exam(s) have calculated results awaiting publication.`, severity: "warning" });
  }

  return items;
}
