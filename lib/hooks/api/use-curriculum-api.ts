"use client";

// Real client hooks for Curriculum / Syllabus Tracking (Phase 9C.1). Read/write
// the live /api/curriculum/* and /api/academics/sections/*/curriculum/*
// endpoints — no mock store, no fake percentage.
import { apiDelete, apiPatch, apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type {
  ChangeCurriculumStatusRequest, CreateCurriculumChapterRequest, CreateCurriculumRequest, CreateCurriculumTopicRequest,
  CreateCurriculumUnitRequest, CurriculumDetailDto, CurriculumInsightsDto, CurriculumListItemDto, SectionCurriculumDto,
  UpdateCurriculumChapterRequest, UpdateCurriculumRequest, UpdateCurriculumTopicRequest, UpdateCurriculumUnitRequest,
  UpdateTopicProgressRequest,
} from "@/lib/api/contracts";

export function useCurriculumList(filters: { classId?: string; subjectId?: string; status?: string; search?: string; page?: number } = {}) {
  return useApiList<CurriculumListItemDto>(`/api/curriculum${buildQuery(filters)}`);
}
export function useCurriculum(curriculumId: string | undefined) {
  return useApiResource<CurriculumDetailDto>(curriculumId ? `/api/curriculum/${curriculumId}` : null);
}
export function useCurriculumInsights() {
  return useApiResource<CurriculumInsightsDto>("/api/curriculum/insights");
}
/** null curriculum = honestly none created yet for this section+subject. */
export function useSectionCurriculum(sectionId: string | undefined, subjectId: string | undefined) {
  return useApiResource<SectionCurriculumDto | null>(sectionId && subjectId ? `/api/academics/sections/${sectionId}/curriculum${buildQuery({ subjectId })}` : null);
}

export const createCurriculumRequest = (body: CreateCurriculumRequest): Promise<ApiResult<CurriculumDetailDto>> => apiPost<CurriculumDetailDto>("/api/curriculum", body);
export const updateCurriculumRequest = (id: string, body: UpdateCurriculumRequest): Promise<ApiResult<CurriculumDetailDto>> => apiPatch<CurriculumDetailDto>(`/api/curriculum/${id}`, body);
export const changeCurriculumStatusRequest = (id: string, body: ChangeCurriculumStatusRequest): Promise<ApiResult<CurriculumDetailDto>> => apiPost<CurriculumDetailDto>(`/api/curriculum/${id}/status`, body);
export const deleteCurriculumRequest = (id: string): Promise<ApiResult<{ id: string }>> => apiDelete<{ id: string }>(`/api/curriculum/${id}`);

export const createUnitRequest = (curriculumId: string, body: CreateCurriculumUnitRequest): Promise<ApiResult<CurriculumDetailDto>> => apiPost<CurriculumDetailDto>(`/api/curriculum/${curriculumId}/units`, body);
export const updateUnitRequest = (unitId: string, body: UpdateCurriculumUnitRequest): Promise<ApiResult<CurriculumDetailDto>> => apiPatch<CurriculumDetailDto>(`/api/curriculum/units/${unitId}`, body);
export const deleteUnitRequest = (unitId: string): Promise<ApiResult<{ id: string }>> => apiDelete<{ id: string }>(`/api/curriculum/units/${unitId}`);

export const createChapterRequest = (unitId: string, body: CreateCurriculumChapterRequest): Promise<ApiResult<CurriculumDetailDto>> => apiPost<CurriculumDetailDto>(`/api/curriculum/units/${unitId}/chapters`, body);
export const updateChapterRequest = (chapterId: string, body: UpdateCurriculumChapterRequest): Promise<ApiResult<CurriculumDetailDto>> => apiPatch<CurriculumDetailDto>(`/api/curriculum/chapters/${chapterId}`, body);
export const deleteChapterRequest = (chapterId: string): Promise<ApiResult<{ id: string }>> => apiDelete<{ id: string }>(`/api/curriculum/chapters/${chapterId}`);

export const createTopicRequest = (chapterId: string, body: CreateCurriculumTopicRequest): Promise<ApiResult<CurriculumDetailDto>> => apiPost<CurriculumDetailDto>(`/api/curriculum/chapters/${chapterId}/topics`, body);
export const updateTopicRequest = (topicId: string, body: UpdateCurriculumTopicRequest): Promise<ApiResult<CurriculumDetailDto>> => apiPatch<CurriculumDetailDto>(`/api/curriculum/topics/${topicId}`, body);
export const deleteTopicRequest = (topicId: string): Promise<ApiResult<{ id: string }>> => apiDelete<{ id: string }>(`/api/curriculum/topics/${topicId}`);

export const updateTopicProgressRequest = (sectionId: string, topicId: string, body: UpdateTopicProgressRequest): Promise<ApiResult<SectionCurriculumDto>> =>
  apiPatch<SectionCurriculumDto>(`/api/academics/sections/${sectionId}/curriculum/topics/${topicId}`, body);
export const completeUnitForSectionRequest = (sectionId: string, unitId: string): Promise<ApiResult<SectionCurriculumDto>> =>
  apiPost<SectionCurriculumDto>(`/api/academics/sections/${sectionId}/curriculum/units/${unitId}/complete`, {});
