"use client";

// Real client hooks for the Academics FOUNDATION (Class/Section/Enrollment),
// Phase 6-pre. Read/write the live /api/academics/* endpoints — no mock store.
import { apiDelete, apiPatch, apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type { ClassDto, EnrollableStudentDto, RosterEntryDto, SectionDto } from "@/lib/api/contracts";

export function useClasses() {
  return useApiList<ClassDto>("/api/academics/classes");
}
export const createClassRequest = (body: { name: string; order?: number }): Promise<ApiResult<ClassDto>> =>
  apiPost<ClassDto>("/api/academics/classes", body);
export const updateClassRequest = (id: string, body: Record<string, unknown>): Promise<ApiResult<ClassDto>> =>
  apiPatch<ClassDto>(`/api/academics/classes/${id}`, body);

export function useSections(classId?: string) {
  return useApiList<SectionDto>(`/api/academics/sections${buildQuery({ classId })}`);
}
export const createSectionRequest = (body: { classId: string; name: string; capacity?: number }): Promise<ApiResult<SectionDto>> =>
  apiPost<SectionDto>("/api/academics/sections", body);

export function useRoster(sectionId: string | undefined) {
  return useApiResource<RosterEntryDto[]>(sectionId ? `/api/academics/sections/${sectionId}/enrollments` : null);
}
export function useEnrollableStudents(enabled: boolean) {
  return useApiResource<EnrollableStudentDto[]>(enabled ? "/api/academics/enrollable-students" : null);
}
export const enrollStudentsRequest = (sectionId: string, studentIds: string[]): Promise<ApiResult<RosterEntryDto[]>> =>
  apiPost<RosterEntryDto[]>(`/api/academics/sections/${sectionId}/enrollments`, { studentIds });
export const unenrollRequest = (enrollmentId: string): Promise<ApiResult<{ id: string }>> =>
  apiDelete<{ id: string }>(`/api/academics/enrollments/${enrollmentId}`);
