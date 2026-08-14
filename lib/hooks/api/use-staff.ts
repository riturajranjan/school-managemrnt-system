"use client";

// Real client hooks for Staff (Phase 6A) + teaching assignments. Read/write the
// live /api/staff + /api/academics/sections/[id]/teaching-assignments endpoints.
// No mock store, no localStorage — PostgreSQL is the only authority.
import { apiDelete, apiPatch, apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type { StaffDetailDto, StaffListItemDto, TeachingAssignmentDto, TeachingStaffOptionDto } from "@/lib/api/contracts";

export function useStaff(params: { search?: string; status?: string; teaching?: boolean } = {}) {
  return useApiList<StaffListItemDto>(`/api/staff${buildQuery({ search: params.search, status: params.status, teaching: params.teaching === undefined ? undefined : String(params.teaching) })}`);
}
export const createStaffRequest = (body: Record<string, unknown>): Promise<ApiResult<StaffDetailDto>> =>
  apiPost<StaffDetailDto>("/api/staff", body);
export const updateStaffRequest = (id: string, body: Record<string, unknown>): Promise<ApiResult<StaffDetailDto>> =>
  apiPatch<StaffDetailDto>(`/api/staff/${id}`, body);
export const setStaffStatusRequest = (id: string, status: "active" | "inactive" | "archived"): Promise<ApiResult<StaffDetailDto>> =>
  apiPost<StaffDetailDto>(`/api/staff/${id}/status`, { status });

/** ACTIVE teaching-eligible staff options for academics/timetable pickers. */
export function useTeachingStaff(enabled = true) {
  return useApiResource<TeachingStaffOptionDto[]>(enabled ? "/api/staff/teachers" : null);
}

export function useTeachingAssignments(sectionId: string | undefined) {
  return useApiResource<TeachingAssignmentDto[]>(sectionId ? `/api/academics/sections/${sectionId}/teaching-assignments` : null);
}
export const assignTeacherRequest = (sectionId: string, subjectId: string, staffId: string): Promise<ApiResult<TeachingAssignmentDto>> =>
  apiPost<TeachingAssignmentDto>(`/api/academics/sections/${sectionId}/teaching-assignments`, { subjectId, staffId });
export const removeTeacherRequest = (sectionId: string, assignmentId: string): Promise<ApiResult<{ id: string }>> =>
  apiDelete<{ id: string }>(`/api/academics/sections/${sectionId}/teaching-assignments/${assignmentId}`);
