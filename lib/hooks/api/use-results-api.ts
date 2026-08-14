"use client";

// Real client hooks for Results & Grading (Phase 8C). Read/write the live
// /api/results/* and /api/exams/*/results* endpoints. No mock store, no
// localStorage — PostgreSQL (via the derived result engine) is the only
// authority.
import { apiPatch, apiPost, apiPut, type ApiResult } from "@/lib/api/client";
import { useApiList, useApiResource } from "./use-api";
import type { ExamResultsDto, GradingSchemeDto } from "@/lib/api/contracts";

export function useGradingSchemes() {
  return useApiList<GradingSchemeDto>("/api/results/grading-schemes");
}
export const createGradingSchemeRequest = (body: { name: string }): Promise<ApiResult<GradingSchemeDto>> =>
  apiPost<GradingSchemeDto>("/api/results/grading-schemes", body);
export const updateGradingSchemeRequest = (id: string, body: Record<string, unknown>): Promise<ApiResult<GradingSchemeDto>> =>
  apiPatch<GradingSchemeDto>(`/api/results/grading-schemes/${id}`, body);
export const saveGradingBandsRequest = (id: string, bands: { label: string; minPercent: number; maxPercent: number; isPass: boolean; order?: number }[]): Promise<ApiResult<GradingSchemeDto>> =>
  apiPut<GradingSchemeDto>(`/api/results/grading-schemes/${id}/bands`, { bands });

export function useExamResults(examId: string | undefined) {
  return useApiResource<ExamResultsDto>(examId ? `/api/exams/${examId}/results` : null);
}
export const publishExamResultsRequest = (examId: string): Promise<ApiResult<ExamResultsDto>> =>
  apiPost<ExamResultsDto>(`/api/exams/${examId}/results/publish`, {});
