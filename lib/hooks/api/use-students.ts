"use client";

// Real-data student hooks (Backend Phase 4). Read/write the live /api/students
// endpoints — the migrated Students pages no longer depend on the mock store.
import { apiDelete, apiPatch, apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type { StudentDetailDto, StudentListItemDto } from "@/lib/api/contracts";

export type StudentListQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string[];
  gender?: string[];
  admissionType?: string[];
  classLabel?: string;
  sectionLabel?: string;
  branchId?: string;
  academicSessionId?: string;
  sort?: string;
  order?: "asc" | "desc";
};

function studentsUrl(q: StudentListQuery): string {
  return `/api/students${buildQuery({
    page: q.page,
    pageSize: q.pageSize,
    search: q.search,
    status: q.status?.length ? q.status.join(",") : undefined,
    gender: q.gender?.length ? q.gender.join(",") : undefined,
    admissionType: q.admissionType?.length ? q.admissionType.join(",") : undefined,
    classLabel: q.classLabel,
    sectionLabel: q.sectionLabel,
    branchId: q.branchId,
    academicSessionId: q.academicSessionId,
    sort: q.sort,
    order: q.order,
  })}`;
}

export function useStudentList(query: StudentListQuery) {
  return useApiList<StudentListItemDto>(studentsUrl(query));
}

export function useStudentDetail(studentId: string | undefined) {
  return useApiResource<StudentDetailDto>(studentId ? `/api/students/${studentId}` : null);
}

// --- Mutations (return ApiResult; callers branch on success) ----------------

export const createStudentRequest = (body: unknown): Promise<ApiResult<StudentDetailDto>> =>
  apiPost<StudentDetailDto>("/api/students", body);

export const updateStudentRequest = (id: string, body: unknown): Promise<ApiResult<StudentDetailDto>> =>
  apiPatch<StudentDetailDto>(`/api/students/${id}`, body);

export const archiveStudentRequest = (id: string): Promise<ApiResult<StudentDetailDto>> =>
  apiDelete<StudentDetailDto>(`/api/students/${id}`);

export const linkGuardianRequest = (studentId: string, body: unknown): Promise<ApiResult<{ linkId: string; guardianId: string }>> =>
  apiPost(`/api/students/${studentId}/guardians`, body);

export const unlinkGuardianRequest = (studentId: string, guardianId: string): Promise<ApiResult<{ success: boolean }>> =>
  apiDelete(`/api/students/${studentId}/guardians/${guardianId}`);

// --- Bulk import (carries a row-level `details` array on validation failure) ---

export type ImportDetail = { row: number; field?: string; message: string };
export type ImportResponse =
  | { success: true; data: { imported: number; failed: number; studentIds: string[] } }
  | { success: false; error: { code: string; message: string; details?: ImportDetail[] } };

export async function importStudentsRequest(students: unknown[]): Promise<ImportResponse> {
  try {
    const res = await fetch("/api/students/import", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ students }),
    });
    return (await res.json()) as ImportResponse;
  } catch {
    return { success: false, error: { code: "NETWORK_ERROR", message: "Network request failed" } };
  }
}
