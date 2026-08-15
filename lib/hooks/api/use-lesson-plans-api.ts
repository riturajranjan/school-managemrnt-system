"use client";

// Real client hooks for Lesson Plans (Phase 9C.2). Read/write the live
// /api/lesson-plans/* endpoints — no mock store, no fake teacher identity, no
// simulated AI generation.
import { apiPatch, apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type { CreateLessonPlanRequest, LessonPlanDetailDto, LessonPlanListItemDto, UpdateLessonPlanRequest } from "@/lib/api/contracts";

export function useLessonPlanList(filters: { sectionId?: string; subjectId?: string; staffId?: string; status?: string; search?: string; page?: number } = {}) {
  return useApiList<LessonPlanListItemDto>(`/api/lesson-plans${buildQuery(filters)}`);
}
/** The caller's own lesson plans — real Staff.id resolved server-side. */
export function useMyLessonPlanList(filters: { status?: string; search?: string; page?: number } = {}) {
  return useApiList<LessonPlanListItemDto>(`/api/lesson-plans/mine${buildQuery(filters)}`);
}
export function useLessonPlan(lessonPlanId: string | undefined) {
  return useApiResource<LessonPlanDetailDto>(lessonPlanId ? `/api/lesson-plans/${lessonPlanId}` : null);
}

export const createLessonPlanRequest = (body: CreateLessonPlanRequest): Promise<ApiResult<LessonPlanDetailDto>> => apiPost<LessonPlanDetailDto>("/api/lesson-plans", body);
export const updateLessonPlanRequest = (id: string, body: UpdateLessonPlanRequest): Promise<ApiResult<LessonPlanDetailDto>> => apiPatch<LessonPlanDetailDto>(`/api/lesson-plans/${id}`, body);
export const submitLessonPlanRequest = (id: string): Promise<ApiResult<LessonPlanDetailDto>> => apiPost<LessonPlanDetailDto>(`/api/lesson-plans/${id}/submit`, {});
export const approveLessonPlanRequest = (id: string): Promise<ApiResult<LessonPlanDetailDto>> => apiPost<LessonPlanDetailDto>(`/api/lesson-plans/${id}/approve`, {});
export const rejectLessonPlanRequest = (id: string, comment: string): Promise<ApiResult<LessonPlanDetailDto>> => apiPost<LessonPlanDetailDto>(`/api/lesson-plans/${id}/reject`, { comment });
export const completeLessonPlanRequest = (id: string): Promise<ApiResult<LessonPlanDetailDto>> => apiPost<LessonPlanDetailDto>(`/api/lesson-plans/${id}/complete`, {});
export const duplicateLessonPlanRequest = (id: string, plannedDate: string): Promise<ApiResult<LessonPlanDetailDto>> => apiPost<LessonPlanDetailDto>(`/api/lesson-plans/${id}/duplicate`, { plannedDate });

/** null url (sectionId/subjectId not chosen yet) skips the fetch entirely —
 *  data reads null, not an empty-but-fetched list. */
export function useAssignableCurriculumTopics(sectionId: string | undefined, subjectId: string | undefined) {
  return useApiResource<{ id: string; title: string; chapterTitle: string; unitTitle: string }[]>(
    sectionId && subjectId ? `/api/academics/sections/${sectionId}/curriculum/assignable-topics${buildQuery({ subjectId })}` : null,
  );
}
