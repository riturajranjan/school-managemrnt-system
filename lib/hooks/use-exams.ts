"use client";

import { useMemo } from "react";
import { useSisStore } from "./use-store";

export function useExams() {
  const db = useSisStore();
  return db.exams;
}

export function useExam(examId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.exams.find((e) => e.id === examId), [db.exams, examId]);
}

export function useExamClasses(examId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => (examId ? db.examClasses.filter((c) => c.examId === examId) : []), [db.examClasses, examId]);
}

export function useExamSubjects(examId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => (examId ? db.examSubjects.filter((s) => s.examId === examId) : []), [db.examSubjects, examId]);
}

export function useExamAttendance(examId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => (examId ? db.examAttendance.filter((a) => a.examId === examId) : []), [db.examAttendance, examId]);
}

export function useStudentMarks(examId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => (examId ? db.studentMarks.filter((m) => m.examId === examId) : []), [db.studentMarks, examId]);
}

export function useMarksEntrySessions(examId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => (examId ? db.marksEntrySessions.filter((s) => s.examId === examId) : []), [db.marksEntrySessions, examId]);
}

export function useMarksVerifications(examId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => (examId ? db.marksVerifications.filter((v) => v.examId === examId) : []), [db.marksVerifications, examId]);
}

export function useGradingSchemes() {
  const db = useSisStore();
  return db.gradingSchemes;
}

export function useGradingScheme(schemeId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.gradingSchemes.find((s) => s.id === schemeId), [db.gradingSchemes, schemeId]);
}

export function useResultRules() {
  const db = useSisStore();
  return db.resultRules;
}

export function useResultRule(ruleId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.resultRules.find((r) => r.id === ruleId), [db.resultRules, ruleId]);
}

export function useExamResults(examId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => (examId ? db.examResults.filter((r) => r.examId === examId) : []), [db.examResults, examId]);
}

export function useStudentResult(examId: string | undefined, studentId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.examResults.find((r) => r.examId === examId && r.studentId === studentId), [db.examResults, examId, studentId]);
}

export function useResultVersions(examId: string | undefined, studentId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.resultVersions.filter((v) => v.examId === examId && v.studentId === studentId), [db.resultVersions, examId, studentId]);
}

export function useResultPublications(examId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => (examId ? db.resultPublications.filter((p) => p.examId === examId) : []), [db.resultPublications, examId]);
}

export function useReportCardTemplates() {
  const db = useSisStore();
  return db.reportCardTemplates;
}

export function useReportCards(examId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => (examId ? db.reportCards.filter((r) => r.examId === examId) : []), [db.reportCards, examId]);
}

export function useReportCardGenerationJobs(examId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => (examId ? db.reportCardGenerationJobs.filter((j) => j.examId === examId) : []), [db.reportCardGenerationJobs, examId]);
}

export function useTeacherRemarks(examId: string | undefined, studentId?: string) {
  const db = useSisStore();
  return useMemo(
    () => (examId ? db.teacherRemarks.filter((r) => r.examId === examId && (!studentId || r.studentId === studentId)) : []),
    [db.teacherRemarks, examId, studentId],
  );
}

export function usePromotionRules() {
  const db = useSisStore();
  return db.promotionRules;
}

export function usePromotionRuns() {
  const db = useSisStore();
  return db.promotionRuns;
}

export function usePromotionRun(runId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.promotionRuns.find((r) => r.id === runId), [db.promotionRuns, runId]);
}

export function useExamAuditLog(examId?: string) {
  const db = useSisStore();
  return useMemo(() => (examId ? db.examAuditLog.filter((e) => e.examId === examId) : db.examAuditLog), [db.examAuditLog, examId]);
}

export function useDismissedExamConflicts() {
  const db = useSisStore();
  return db.dismissedExamConflicts;
}
