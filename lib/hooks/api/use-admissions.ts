"use client";

// Real-data admission hooks (Backend Phase 4). Read/write the live /api/admissions
// endpoints — the migrated Admissions pages no longer depend on the mock store.
import { apiPatch, apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type {
  AdmissionConvertResultDto,
  AdmissionDetailDto,
  AdmissionListItemDto,
  AdmissionNoteDto,
  AdmissionStatsDto,
} from "@/lib/api/contracts";

export type AdmissionListQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  stage?: string[];
  source?: string[];
  appliedClass?: string;
  branchId?: string;
  academicSessionId?: string;
  assignedOfficerId?: string;
};

function admissionsUrl(q: AdmissionListQuery): string {
  return `/api/admissions${buildQuery({
    page: q.page,
    pageSize: q.pageSize,
    search: q.search,
    stage: q.stage?.length ? q.stage.join(",") : undefined,
    source: q.source?.length ? q.source.join(",") : undefined,
    appliedClass: q.appliedClass,
    branchId: q.branchId,
    academicSessionId: q.academicSessionId,
    assignedOfficerId: q.assignedOfficerId,
  })}`;
}

export function useAdmissionList(query: AdmissionListQuery) {
  return useApiList<AdmissionListItemDto>(admissionsUrl(query));
}

export function useAdmissionDetail(applicationId: string | undefined) {
  return useApiResource<AdmissionDetailDto>(applicationId ? `/api/admissions/${applicationId}` : null);
}

export function useAdmissionStats() {
  return useApiResource<AdmissionStatsDto>("/api/admissions/stats");
}

// --- Mutations --------------------------------------------------------------

export const createAdmissionRequest = (body: unknown): Promise<ApiResult<AdmissionListItemDto>> =>
  apiPost<AdmissionListItemDto>("/api/admissions", body);

export const updateAdmissionRequest = (id: string, body: unknown): Promise<ApiResult<AdmissionListItemDto>> =>
  apiPatch<AdmissionListItemDto>(`/api/admissions/${id}`, body);

export const changeStageRequest = (id: string, stage: string, reason?: string): Promise<ApiResult<AdmissionListItemDto>> =>
  apiPost<AdmissionListItemDto>(`/api/admissions/${id}/stage`, { stage, reason });

export const addNoteRequest = (id: string, body: string, pinned?: boolean): Promise<ApiResult<AdmissionNoteDto>> =>
  apiPost<AdmissionNoteDto>(`/api/admissions/${id}/notes`, { body, pinned });

export const convertApplicationRequest = (id: string, body?: unknown): Promise<ApiResult<AdmissionConvertResultDto>> =>
  apiPost<AdmissionConvertResultDto>(`/api/admissions/${id}/convert`, body ?? {});
