"use client";

// Real client hooks for Academics Core — Subjects (Phase 6). Read/write the live
// /api/academics/subjects + /api/academics/classes/[id]/subjects endpoints. No
// mock store, no localStorage — the PostgreSQL catalogue is the only authority.
import { apiDelete, apiPatch, apiPost, apiPut, type ApiResult } from "@/lib/api/client";
import { useApiList, useApiResource } from "./use-api";
import type { ClassSubjectDto, SubjectDto } from "@/lib/api/contracts";

export function useSubjects() {
  return useApiList<SubjectDto>("/api/academics/subjects");
}

export const createSubjectRequest = (body: Record<string, unknown>): Promise<ApiResult<SubjectDto>> =>
  apiPost<SubjectDto>("/api/academics/subjects", body);
export const updateSubjectRequest = (id: string, body: Record<string, unknown>): Promise<ApiResult<SubjectDto>> =>
  apiPatch<SubjectDto>(`/api/academics/subjects/${id}`, body);
export const setSubjectStatusRequest = (id: string, status: "active" | "inactive"): Promise<ApiResult<SubjectDto>> =>
  apiPost<SubjectDto>(`/api/academics/subjects/${id}/status`, { status });
export const duplicateSubjectRequest = (id: string): Promise<ApiResult<SubjectDto>> =>
  apiPost<SubjectDto>(`/api/academics/subjects/${id}/duplicate`);

export function useClassSubjects(classId: string | undefined) {
  return useApiResource<ClassSubjectDto[]>(classId ? `/api/academics/classes/${classId}/subjects` : null);
}
export function useSubjectClasses(subjectId: string | undefined) {
  return useApiResource<ClassSubjectDto[]>(subjectId ? `/api/academics/subjects/${subjectId}/classes` : null);
}
export function useSectionSubjects(sectionId: string | undefined) {
  return useApiResource<SubjectDto[]>(sectionId ? `/api/academics/sections/${sectionId}/subjects` : null);
}
export const assignClassSubjectRequest = (classId: string, subjectId: string): Promise<ApiResult<ClassSubjectDto>> =>
  apiPost<ClassSubjectDto>(`/api/academics/classes/${classId}/subjects`, { subjectId });
export const reconcileClassSubjectsRequest = (classId: string, subjectIds: string[]): Promise<ApiResult<ClassSubjectDto[]>> =>
  apiPut<ClassSubjectDto[]>(`/api/academics/classes/${classId}/subjects`, { subjectIds });
export const removeClassSubjectRequest = (classId: string, assignmentId: string): Promise<ApiResult<{ id: string }>> =>
  apiDelete<{ id: string }>(`/api/academics/classes/${classId}/subjects/${assignmentId}`);
