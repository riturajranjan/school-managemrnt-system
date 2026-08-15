"use client";

// Real client hooks for Homework / Assignments (Phase 9B). Read/write the
// live /api/homework/* endpoints — no mock store, no fake teacher identity.
import { apiPatch, apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type { AssignableTeachingDto, CreateHomeworkRequest, HomeworkDetailDto, HomeworkListItemDto, UpdateHomeworkRequest } from "@/lib/api/contracts";

export function useHomeworkList(filters: { sectionId?: string; subjectId?: string; staffId?: string; status?: string; search?: string; page?: number } = {}) {
  return useApiList<HomeworkListItemDto>(`/api/homework${buildQuery(filters)}`);
}

/** The caller's own homework — real Staff.id resolved server-side. */
export function useMyHomeworkList(filters: { status?: string; search?: string; page?: number } = {}) {
  return useApiList<HomeworkListItemDto>(`/api/homework/mine${buildQuery(filters)}`);
}

export function useHomework(homeworkId: string | undefined) {
  return useApiResource<HomeworkDetailDto>(homeworkId ? `/api/homework/${homeworkId}` : null);
}

export function useAssignableTeaching() {
  return useApiList<AssignableTeachingDto>("/api/homework/assignable");
}

export const createHomeworkRequest = (body: CreateHomeworkRequest): Promise<ApiResult<HomeworkDetailDto>> => apiPost<HomeworkDetailDto>("/api/homework", body);
export const updateHomeworkRequest = (id: string, body: UpdateHomeworkRequest): Promise<ApiResult<HomeworkDetailDto>> => apiPatch<HomeworkDetailDto>(`/api/homework/${id}`, body);
export const publishHomeworkRequest = (id: string): Promise<ApiResult<HomeworkDetailDto>> => apiPost<HomeworkDetailDto>(`/api/homework/${id}/publish`, {});
export const closeHomeworkRequest = (id: string): Promise<ApiResult<HomeworkDetailDto>> => apiPost<HomeworkDetailDto>(`/api/homework/${id}/close`, {});
export const duplicateHomeworkRequest = (id: string): Promise<ApiResult<HomeworkDetailDto>> => apiPost<HomeworkDetailDto>(`/api/homework/${id}/duplicate`, {});
