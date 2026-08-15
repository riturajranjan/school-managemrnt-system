"use client";

// Real client hooks for Leave Management (Phase 9E.2). Reads the live
// /api/leave/* endpoints — no mock hrLeaveRequests/leaveRequests store.
import { apiPatch, apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList } from "./use-api";
import type {
  CreateLeaveRequestRequest,
  CreateLeaveTypeRequest,
  LeaveRequestDto,
  LeaveTypeDto,
  RejectLeaveRequestRequest,
  UpdateLeaveTypeRequest,
} from "@/lib/api/contracts";

export function useLeaveTypes() {
  return useApiList<LeaveTypeDto>("/api/leave/types");
}

export function useLeaveRequests(params: { staffId?: string; status?: string } = {}) {
  return useApiList<LeaveRequestDto>(`/api/leave/requests${buildQuery(params)}`);
}

export const createLeaveTypeRequest = (body: CreateLeaveTypeRequest): Promise<ApiResult<LeaveTypeDto>> => apiPost<LeaveTypeDto>("/api/leave/types", body);
export const updateLeaveTypeRequest = (id: string, body: UpdateLeaveTypeRequest): Promise<ApiResult<LeaveTypeDto>> => apiPatch<LeaveTypeDto>(`/api/leave/types/${id}`, body);

export const submitLeaveRequest = (body: CreateLeaveRequestRequest): Promise<ApiResult<LeaveRequestDto>> => apiPost<LeaveRequestDto>("/api/leave/requests", body);
export const approveLeaveRequest = (id: string): Promise<ApiResult<LeaveRequestDto>> => apiPost<LeaveRequestDto>(`/api/leave/requests/${id}/approve`, {});
export const rejectLeaveRequest = (id: string, body: RejectLeaveRequestRequest): Promise<ApiResult<LeaveRequestDto>> => apiPost<LeaveRequestDto>(`/api/leave/requests/${id}/reject`, body);
export const cancelLeaveRequest = (id: string): Promise<ApiResult<LeaveRequestDto>> => apiPost<LeaveRequestDto>(`/api/leave/requests/${id}/cancel`, {});
