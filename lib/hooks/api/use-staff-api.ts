"use client";

// Real client hooks for Staff / Teachers (Phase 6A foundation, Phase 9J
// directory + detail cutover). Read/write the live /api/staff/* endpoints —
// no mock store, no fake teacher identity, no CURRENT_TEACHER_ID.
import { apiGet, apiPatch, apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type {
  StaffDetailDto,
  StaffListItemDto,
  StaffTeachingAssignmentDto,
  TeacherDetailDto,
  TeachingLoadSummaryDto,
} from "@/lib/api/contracts";

export type StaffListFilters = {
  search?: string;
  status?: string;
  branchId?: string;
  teaching?: boolean;
  departmentId?: string;
  designationId?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
};

export function useStaffList(filters: StaffListFilters = {}) {
  const { teaching, ...rest } = filters;
  return useApiList<StaffListItemDto>(`/api/staff${buildQuery({ ...rest, teaching: teaching === undefined ? undefined : String(teaching) })}`);
}

export function useStaff(staffId: string | undefined) {
  return useApiResource<StaffDetailDto>(staffId ? `/api/staff/${staffId}` : null);
}

export function useTeacherDetail(staffId: string | undefined) {
  return useApiResource<TeacherDetailDto>(staffId ? `/api/staff/${staffId}/teacher-detail` : null);
}

export function useMyTeachingAssignments() {
  return useApiList<StaffTeachingAssignmentDto>("/api/teaching-assignments/mine");
}

/** Bulk teaching-load summary (subjects/sections/weekly periods) for a set of staff — used by the Teachers directory list. */
export async function fetchTeachingLoadSummary(staffIds: string[]): Promise<Map<string, TeachingLoadSummaryDto>> {
  if (staffIds.length === 0) return new Map();
  const res = await apiGet<TeachingLoadSummaryDto[]>(`/api/staff/load-summary${buildQuery({ staffIds: staffIds.join(",") })}`);
  return res.success ? new Map(res.data.map((s) => [s.staffId, s])) : new Map();
}

export type CreateStaffInput = {
  employeeCode: string;
  firstName: string;
  lastName?: string;
  displayName?: string;
  email?: string;
  phone?: string;
  designation?: string;
  department?: string;
  departmentId?: string | null;
  designationId?: string | null;
  employmentType?: StaffDetailDto["employmentType"];
  isTeaching?: boolean;
  joiningDate?: string;
  userId?: string;
};
export type UpdateStaffInput = Partial<Omit<CreateStaffInput, "userId">>;

export const createStaffRequest = (body: CreateStaffInput): Promise<ApiResult<StaffDetailDto>> => apiPost<StaffDetailDto>("/api/staff", body);
export const updateStaffRequest = (staffId: string, body: UpdateStaffInput): Promise<ApiResult<StaffDetailDto>> => apiPatch<StaffDetailDto>(`/api/staff/${staffId}`, body);
export const setStaffStatusRequest = (staffId: string, status: StaffDetailDto["status"]): Promise<ApiResult<StaffDetailDto>> => apiPost<StaffDetailDto>(`/api/staff/${staffId}/status`, { status });
export const setStaffUserRequest = (staffId: string, userId: string | null): Promise<ApiResult<StaffDetailDto>> => apiPost<StaffDetailDto>(`/api/staff/${staffId}/user`, { userId });
