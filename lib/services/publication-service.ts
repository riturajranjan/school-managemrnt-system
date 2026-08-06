import { getSnapshot, setState, type Db } from "@/lib/data/store";
import type { ResultPublicationChannel, ResultPublicationScope } from "@/lib/types/results";
import { checkResultCalculationConfig } from "./result-processing-service";
import { generateId } from "@/lib/utils";
import { logExamAudit } from "./exam-audit-service";

export type PublicationChecklistItem = { key: string; label: string; done: boolean };

export function computePublicationChecklist(db: Db, examId: string): PublicationChecklistItem[] {
  const exam = db.exams.find((e) => e.id === examId);
  const examSubjects = db.examSubjects.filter((s) => s.examId === examId);
  const sessions = db.marksEntrySessions.filter((s) => s.examId === examId);
  const verifications = db.marksVerifications.filter((v) => v.examId === examId);
  const results = db.examResults.filter((r) => r.examId === examId);
  const reportCards = db.reportCards.filter((rc) => rc.examId === examId);
  const configErrors = checkResultCalculationConfig(db, examId);

  const marksComplete = sessions.length > 0 && sessions.every((s) => s.status === "submitted" || s.status === "locked");
  const attendanceComplete = examSubjects.every((s) => db.examAttendance.some((a) => a.examSubjectId === s.id));
  const verificationComplete = verifications.length > 0 && verifications.every((v) => v.status === "verified" || v.status === "approved" || v.status === "locked");

  return [
    { key: "marks", label: "Marks entry complete", done: marksComplete },
    { key: "attendance", label: "Exam attendance complete", done: attendanceComplete },
    { key: "verification", label: "Marks verification complete", done: verificationComplete },
    { key: "calculated", label: "Results calculated", done: results.length > 0 },
    { key: "errors", label: "No configuration errors", done: configErrors.length === 0 },
    { key: "reportCards", label: "Report cards generated", done: reportCards.length > 0 && reportCards.length >= results.length },
    { key: "remarks", label: "Teacher remarks added", done: db.teacherRemarks.some((r) => r.examId === examId) },
    { key: "approval", label: "Exam not already published", done: exam?.status !== "published" },
  ];
}

export function publishResults(
  examId: string,
  scope: ResultPublicationScope,
  target: { classId?: string; sectionId?: string; studentIds?: string[] },
  channels: ResultPublicationChannel[],
  actor: { name: string; role: string },
  publishAt?: string,
) {
  const db = getSnapshot();
  const resultCount = db.examResults.filter((r) => r.examId === examId).length;
  if (resultCount === 0) {
    // Service-layer guard, independent of the publish page's checklist gate — results
    // must exist before an exam can ever be marked published.
    throw new Error("Cannot publish: no results have been calculated for this exam yet.");
  }

  const now = new Date().toISOString();
  const publication = {
    id: generateId("rp"),
    examId,
    scope,
    classId: target.classId,
    sectionId: target.sectionId,
    studentIds: target.studentIds,
    status: publishAt && publishAt > now ? ("scheduled" as const) : ("published" as const),
    publishAt,
    channels,
    publishedBy: actor.name,
    publishedAt: publishAt && publishAt > now ? undefined : now,
  };

  setState((db) => ({
    ...db,
    resultPublications: [...db.resultPublications.filter((p) => p.examId !== examId), publication],
    exams: db.exams.map((e) => (e.id === examId ? { ...e, status: "published", updatedAt: now } : e)),
    reportCards: db.reportCards.map((rc) => (rc.examId === examId ? { ...rc, status: "published", publishedAt: now } : rc)),
  }));

  logExamAudit({
    examId,
    action: "result-published",
    actorName: actor.name,
    actorRole: actor.role,
    summary: publication.status === "scheduled" ? `Result publication scheduled for ${publishAt}.` : `Results published (${scope}) via ${channels.join(", ") || "no channels"}.`,
  });

  return publication;
}

export function revokePublication(publicationId: string, reason: string, actor: { name: string; role: string }) {
  const db = getSnapshot();
  const publication = db.resultPublications.find((p) => p.id === publicationId);
  if (!publication) return;

  setState((current) => ({
    ...current,
    resultPublications: current.resultPublications.map((p) => (p.id === publicationId ? { ...p, status: "revoked", revokedBy: actor.name, revokedAt: new Date().toISOString(), revokeReason: reason } : p)),
    exams: current.exams.map((e) => (e.id === publication.examId ? { ...e, status: "result-ready" } : e)),
  }));

  logExamAudit({ examId: publication.examId, action: "publication-revoked", actorName: actor.name, actorRole: actor.role, summary: "Result publication revoked.", reason });
}
