import type { Db } from "@/lib/data/store";

export type ExamStageStatus = "not-started" | "in-progress" | "complete";

export type ExamReadiness = {
  subjectCount: number;
  subjectsConfigured: ExamStageStatus;
  scheduledSubjectCount: number;
  scheduleComplete: ExamStageStatus;
  attendanceCompletionPercent: number;
  attendanceComplete: ExamStageStatus;
  marksEntryPercent: number;
  marksEntryComplete: ExamStageStatus;
  verificationPercent: number;
  verificationComplete: ExamStageStatus;
  resultsCalculated: boolean;
  reportCardsGenerated: ExamStageStatus;
  published: boolean;
};

function stageFromPercent(percent: number): ExamStageStatus {
  if (percent <= 0) return "not-started";
  if (percent >= 100) return "complete";
  return "in-progress";
}

export function computeExamReadiness(db: Db, examId: string): ExamReadiness {
  const subjects = db.examSubjects.filter((s) => s.examId === examId);
  const subjectCount = subjects.length;
  const scheduledSubjectCount = subjects.filter((s) => s.date && s.startTime && s.roomId).length;
  const scheduleComplete = stageFromPercent(subjectCount === 0 ? 0 : (scheduledSubjectCount / subjectCount) * 100);

  const attendanceBySubject = new Set(db.examAttendance.filter((a) => a.examId === examId).map((a) => a.examSubjectId));
  const attendanceCompletionPercent = subjectCount === 0 ? 0 : Math.round((attendanceBySubject.size / subjectCount) * 100);

  const sessions = db.marksEntrySessions.filter((s) => s.examId === examId);
  const marksEntryPercent = sessions.length === 0 ? 0 : Math.round(sessions.reduce((sum, s) => sum + s.completionPercent, 0) / sessions.length);

  const verifications = db.marksVerifications.filter((v) => v.examId === examId);
  const verifiedCount = verifications.filter((v) => v.status === "verified" || v.status === "approved" || v.status === "locked").length;
  const verificationPercent = verifications.length === 0 ? 0 : Math.round((verifiedCount / verifications.length) * 100);

  const results = db.examResults.filter((r) => r.examId === examId);
  const resultsCalculated = results.length > 0;

  const reportCards = db.reportCards.filter((rc) => rc.examId === examId);
  const reportCardsGenerated = stageFromPercent(resultsCalculated ? Math.round((reportCards.filter((rc) => rc.status !== "pending" && rc.status !== "failed").length / Math.max(results.length, 1)) * 100) : 0);

  const publication = db.resultPublications.find((p) => p.examId === examId);
  const published = publication?.status === "published";

  return {
    subjectCount,
    subjectsConfigured: subjectCount === 0 ? "not-started" : "complete",
    scheduledSubjectCount,
    scheduleComplete,
    attendanceCompletionPercent,
    attendanceComplete: stageFromPercent(attendanceCompletionPercent),
    marksEntryPercent,
    marksEntryComplete: stageFromPercent(marksEntryPercent),
    verificationPercent,
    verificationComplete: stageFromPercent(verificationPercent),
    resultsCalculated,
    reportCardsGenerated,
    published,
  };
}
