import { getSnapshot, setState } from "@/lib/data/store";
import type { MarksVerification, MarksVerificationAction, MarksVerificationActionType, MarksVerificationStage } from "@/lib/types/marks";
import { generateId } from "@/lib/utils";
import { logExamAudit } from "./exam-audit-service";

function ensureRecord(examId: string, examSubjectId: string): MarksVerification {
  const db = getSnapshot();
  const existing = db.marksVerifications.find((v) => v.examSubjectId === examSubjectId);
  if (existing) return existing;
  const created: MarksVerification = { id: generateId("mv"), examId, examSubjectId, status: "submitted", currentStage: "subject-teacher", history: [] };
  setState((current) => ({ ...current, marksVerifications: [...current.marksVerifications, created] }));
  return created;
}

function applyAction(examSubjectId: string, action: MarksVerificationActionType, stage: MarksVerificationStage, nextStatus: MarksVerification["status"], nextStage: MarksVerificationStage, actor: { name: string; role: string }, comment?: string) {
  const entry: MarksVerificationAction = { id: generateId("mva"), stage, action, actorName: actor.name, actorRole: actor.role, comment, createdAt: new Date().toISOString() };
  setState((db) => ({
    ...db,
    marksVerifications: db.marksVerifications.map((v) =>
      v.examSubjectId === examSubjectId ? { ...v, status: nextStatus, currentStage: nextStage, history: [...v.history, entry] } : v,
    ),
  }));
}

export function verifyMarks(examId: string, examSubjectId: string, actor: { name: string; role: string }, comment?: string) {
  ensureRecord(examId, examSubjectId);
  applyAction(examSubjectId, "verify", "exam-controller", "verified", "principal", actor, comment);
  logExamAudit({ examId, action: "marks-approved", actorName: actor.name, actorRole: actor.role, summary: "Marks verified.", reason: comment });
}

export function approveMarks(examId: string, examSubjectId: string, actor: { name: string; role: string }, comment?: string) {
  ensureRecord(examId, examSubjectId);
  applyAction(examSubjectId, "approve", "principal", "approved", "principal", actor, comment);
  logExamAudit({ examId, action: "marks-approved", actorName: actor.name, actorRole: actor.role, summary: "Marks approved.", reason: comment });
}

export function requestCorrection(examId: string, examSubjectId: string, actor: { name: string; role: string }, comment: string) {
  ensureRecord(examId, examSubjectId);
  applyAction(examSubjectId, "request-changes", "exam-controller", "changes-requested", "subject-teacher", actor, comment);
  logExamAudit({ examId, action: "verification-requested", actorName: actor.name, actorRole: actor.role, summary: "Requested correction to submitted marks.", reason: comment });
}

export function reopenVerification(examId: string, examSubjectId: string, actor: { name: string; role: string }, reason: string) {
  ensureRecord(examId, examSubjectId);
  applyAction(examSubjectId, "reopen", "exam-controller", "draft", "subject-teacher", actor, reason);
  logExamAudit({ examId, action: "manual-override-used", actorName: actor.name, actorRole: actor.role, summary: "Reopened verification.", reason });
}

export function lockVerification(examId: string, examSubjectId: string, actor: { name: string; role: string }) {
  ensureRecord(examId, examSubjectId);
  applyAction(examSubjectId, "lock", "principal", "locked", "principal", actor);
  logExamAudit({ examId, action: "marks-modified", actorName: actor.name, actorRole: actor.role, summary: "Locked verified marks." });
}

/** Bulk-verifies only subjects with no failed/missing-marks anomalies — the caller
 * (marks-verification page) is responsible for computing which examSubjectIds qualify. */
export function bulkVerify(examId: string, examSubjectIds: string[], actor: { name: string; role: string }) {
  for (const id of examSubjectIds) verifyMarks(examId, id, actor, "Bulk-verified — no anomalies detected.");
}
