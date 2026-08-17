"use client";

// Real client hooks for Visitor Management (Phase 9I). Reads/writes the live
// /api/visitors/* endpoints — no mock db.visitors/visitorAppointments store
// authority anywhere below.
import { apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type { CreateExpectedVisitRequest, CreateWalkInVisitRequest, VisitorDashboardDto, VisitorVisitDetailDto, VisitorVisitListItemDto, VisitorVisitStatusDto } from "@/lib/api/contracts";

export function useVisits(params: { status?: VisitorVisitStatusDto; hostStaffId?: string; search?: string; date?: string; pageSize?: number } = {}) {
  return useApiList<VisitorVisitListItemDto>(`/api/visitors/visits${buildQuery(params)}`);
}
export function useVisit(id: string | null) {
  return useApiResource<VisitorVisitDetailDto>(id ? `/api/visitors/visits/${id}` : null);
}
export const createWalkInVisitRequest = (body: CreateWalkInVisitRequest): Promise<ApiResult<VisitorVisitDetailDto>> => apiPost<VisitorVisitDetailDto>("/api/visitors/visits/walk-in", body);
export const createExpectedVisitRequest = (body: CreateExpectedVisitRequest): Promise<ApiResult<VisitorVisitDetailDto>> => apiPost<VisitorVisitDetailDto>("/api/visitors/visits/expected", body);
export const checkInVisitRequest = (id: string): Promise<ApiResult<VisitorVisitDetailDto>> => apiPost<VisitorVisitDetailDto>(`/api/visitors/visits/${id}/check-in`, {});
export const checkOutVisitRequest = (id: string): Promise<ApiResult<VisitorVisitDetailDto>> => apiPost<VisitorVisitDetailDto>(`/api/visitors/visits/${id}/check-out`, {});
export const cancelVisitRequest = (id: string): Promise<ApiResult<VisitorVisitDetailDto>> => apiPost<VisitorVisitDetailDto>(`/api/visitors/visits/${id}/cancel`, {});

export function useVisitorDashboard() {
  return useApiResource<VisitorDashboardDto>("/api/visitors/dashboard");
}
