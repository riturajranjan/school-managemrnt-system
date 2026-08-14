"use client";

// Real client hooks for Exams (Phase 8A). Read/write the live /api/exams/*
// endpoints. No mock store, no localStorage — PostgreSQL is the only authority.
import { apiDelete, apiPatch, apiPost, apiPut, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type { ExamDetailDto, ExamListItemDto, ExamScheduleEntryDto, ExamTermDto, ExamTermStatus, ExamStatus } from "@/lib/api/contracts";

export function useExamTerms() {
  return useApiList<ExamTermDto>("/api/exams/terms");
}
export const createTermRequest = (body: { name: string; code: string; order?: number }): Promise<ApiResult<ExamTermDto>> =>
  apiPost<ExamTermDto>("/api/exams/terms", body);
export const updateTermRequest = (id: string, body: Record<string, unknown>): Promise<ApiResult<ExamTermDto>> =>
  apiPatch<ExamTermDto>(`/api/exams/terms/${id}`, body);
export const setTermStatusRequest = (id: string, status: ExamTermStatus): Promise<ApiResult<ExamTermDto>> =>
  apiPost<ExamTermDto>(`/api/exams/terms/${id}/status`, { status });

export function useExams(params: { status?: string; termId?: string; search?: string } = {}) {
  return useApiList<ExamListItemDto>(`/api/exams${buildQuery(params)}`);
}
export function useExam(examId: string | undefined) {
  return useApiResource<ExamDetailDto>(examId ? `/api/exams/${examId}` : null);
}
export const createExamRequest = (body: Record<string, unknown>): Promise<ApiResult<ExamDetailDto>> =>
  apiPost<ExamDetailDto>("/api/exams", body);
export const updateExamRequest = (id: string, body: Record<string, unknown>): Promise<ApiResult<ExamDetailDto>> =>
  apiPatch<ExamDetailDto>(`/api/exams/${id}`, body);
export const setExamStatusRequest = (id: string, status: ExamStatus): Promise<ApiResult<ExamDetailDto>> =>
  apiPost<ExamDetailDto>(`/api/exams/${id}/status`, { status });
export const reconcileExamClassesRequest = (examId: string, classIds: string[]): Promise<ApiResult<{ id: string; name: string }[]>> =>
  apiPut<{ id: string; name: string }[]>(`/api/exams/${examId}/classes`, { classIds });

export function useExamSchedule(examId: string | undefined) {
  return useApiResource<ExamScheduleEntryDto[]>(examId ? `/api/exams/${examId}/schedule` : null);
}
export const createScheduleEntryRequest = (examId: string, body: Record<string, unknown>): Promise<ApiResult<ExamScheduleEntryDto>> =>
  apiPost<ExamScheduleEntryDto>(`/api/exams/${examId}/schedule`, body);
export const updateScheduleEntryRequest = (examId: string, entryId: string, body: Record<string, unknown>): Promise<ApiResult<ExamScheduleEntryDto>> =>
  apiPatch<ExamScheduleEntryDto>(`/api/exams/${examId}/schedule/${entryId}`, body);
export const deleteScheduleEntryRequest = (examId: string, entryId: string): Promise<ApiResult<{ id: string }>> =>
  apiDelete<{ id: string }>(`/api/exams/${examId}/schedule/${entryId}`);
