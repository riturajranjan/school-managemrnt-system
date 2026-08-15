"use client";

// Real client hooks for Report Cards (Phase 8D). Read-only: /api/report-cards/*.
// No mock store, no localStorage — PostgreSQL (the Phase 8C published-result
// snapshot) is the only authority.
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type { ReportCardDto, ReportCardExamSummaryDto, ReportCardRosterEntryDto } from "@/lib/api/contracts";

export function useReportCardExams() {
  return useApiList<ReportCardExamSummaryDto>("/api/report-cards");
}

export function useReportCardRoster(examId: string | undefined, search?: string) {
  const url = examId ? `/api/report-cards/${examId}${buildQuery({ q: search })}` : null;
  return useApiResource<{ exam: ReportCardExamSummaryDto; students: ReportCardRosterEntryDto[] }>(url);
}

export function useReportCard(examId: string | undefined, studentId: string | undefined) {
  return useApiResource<ReportCardDto>(examId && studentId ? `/api/report-cards/${examId}/${studentId}` : null);
}
