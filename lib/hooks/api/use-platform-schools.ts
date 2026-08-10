"use client";

// Real-data platform school hooks (Super Admin SA-2). These read/write the live
// /api/super-admin/schools endpoints — the schools directory, detail and
// provisioning no longer depend on the SaaS mock store.
import { apiPatch, apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type {
  PlatformProvisionResultDto,
  PlatformSchoolDetailDto,
  PlatformSchoolListItemDto,
} from "@/lib/api/contracts";

export type SchoolListQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  sort?: string;
  order?: "asc" | "desc";
};

export function useSchoolList(query: SchoolListQuery) {
  const url = `/api/super-admin/schools${buildQuery({
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
    status: query.status && query.status !== "all" ? query.status : undefined,
    sort: query.sort,
    order: query.order,
  })}`;
  return useApiList<PlatformSchoolListItemDto>(url);
}

export function useSchoolDetail(schoolId: string | undefined) {
  return useApiResource<PlatformSchoolDetailDto>(schoolId ? `/api/super-admin/schools/${schoolId}` : null);
}

export const provisionSchoolRequest = (body: unknown): Promise<ApiResult<PlatformProvisionResultDto>> =>
  apiPost<PlatformProvisionResultDto>("/api/super-admin/schools", body);

export const updateSchoolRequest = (id: string, body: unknown): Promise<ApiResult<PlatformSchoolDetailDto>> =>
  apiPatch<PlatformSchoolDetailDto>(`/api/super-admin/schools/${id}`, body);

export const setSchoolStatusRequest = (id: string, status: "active" | "suspended"): Promise<ApiResult<PlatformSchoolDetailDto>> =>
  apiPost<PlatformSchoolDetailDto>(`/api/super-admin/schools/${id}/status`, { status });
