"use client";

// Real client hooks for Counseling / Student Wellbeing (Phase 9S). Reads/
// writes the live /api/counseling/* endpoints — no mock
// db.counsellingAppointments. Confidential note hooks are kept separate from
// case/session hooks so a component never accidentally pulls note content
// into a list view.
import { apiPatch, apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type {
  AssignCounselingCaseRequest,
  CounselingCaseDto,
  CounselingDashboardDto,
  CounselingSessionDto,
  CounselingSessionNoteDto,
  CreateCounselingNoteRequest,
  CreateCounselingReferralRequest,
  CreateCounselingSessionRequest,
  StudentCounselingProfileDto,
  UpdateCounselingCaseRequest,
} from "@/lib/api/contracts";

// ── Cases ────────────────────────────────────────────────────────────────

export function useCounselingCases(filters: { studentId?: string; status?: string; assignedCounselorStaffId?: string; unassigned?: boolean } = {}) {
  const { unassigned, ...rest } = filters;
  return useApiList<CounselingCaseDto>(`/api/counseling/cases${buildQuery({ ...rest, unassigned: unassigned === undefined ? undefined : String(unassigned) })}`);
}
export function useCounselingCase(caseId: string | undefined) {
  return useApiResource<CounselingCaseDto>(caseId ? `/api/counseling/cases/${caseId}` : null);
}
export const createCounselingReferralRequest = (body: CreateCounselingReferralRequest): Promise<ApiResult<CounselingCaseDto>> => apiPost<CounselingCaseDto>("/api/counseling/cases", body);
export const updateCounselingCaseRequest = (id: string, body: UpdateCounselingCaseRequest): Promise<ApiResult<CounselingCaseDto>> => apiPatch<CounselingCaseDto>(`/api/counseling/cases/${id}`, body);
export const assignCounselingCaseRequest = (id: string, body: AssignCounselingCaseRequest): Promise<ApiResult<CounselingCaseDto>> => apiPost<CounselingCaseDto>(`/api/counseling/cases/${id}/assign`, body);
export const closeCounselingCaseRequest = (id: string): Promise<ApiResult<CounselingCaseDto>> => apiPost<CounselingCaseDto>(`/api/counseling/cases/${id}/close`, {});

// ── Sessions ─────────────────────────────────────────────────────────────

export function useCounselingSessions(caseId: string) {
  return useApiList<CounselingSessionDto>(`/api/counseling/cases/${caseId}/sessions`);
}
export const createCounselingSessionRequest = (caseId: string, body: CreateCounselingSessionRequest): Promise<ApiResult<CounselingSessionDto>> =>
  apiPost<CounselingSessionDto>(`/api/counseling/cases/${caseId}/sessions`, body);

// ── Confidential notes ───────────────────────────────────────────────────

export function useCounselingSessionNotes(sessionId: string) {
  return useApiList<CounselingSessionNoteDto>(`/api/counseling/sessions/${sessionId}/notes`);
}
export const createCounselingNoteRequest = (sessionId: string, body: CreateCounselingNoteRequest): Promise<ApiResult<CounselingSessionNoteDto>> =>
  apiPost<CounselingSessionNoteDto>(`/api/counseling/sessions/${sessionId}/notes`, body);

// ── Dashboard ────────────────────────────────────────────────────────────

export function useCounselingDashboard() {
  return useApiResource<CounselingDashboardDto>("/api/counseling/dashboard");
}

// ── Student 360 ──────────────────────────────────────────────────────────

export function useStudentCounselingProfile(studentId: string | undefined) {
  return useApiResource<StudentCounselingProfileDto>(studentId ? `/api/students/${studentId}/counseling` : null);
}
