"use client";

// Real client hooks for Asset Management (Phase 9O). Reads/writes the live
// /api/assets/* endpoints — no mock store, no fabricated depreciation.
import { apiPatch, apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type {
  AssetAssignmentDto,
  AssetDashboardDto,
  AssetDto,
  AssetHistoryEventDto,
  AssetMaintenanceDto,
  AssignAssetRequest,
  CompleteMaintenanceRequest,
  CreateAssetRequest,
  OpenMaintenanceRequest,
  SetAssetStatusRequest,
  UpdateAssetRequest,
} from "@/lib/api/contracts";

// ── Register ─────────────────────────────────────────────────────────────

export function useAssets(filters: { search?: string; status?: string; category?: string } = {}) {
  return useApiList<AssetDto>(`/api/assets${buildQuery(filters)}`);
}
export function useAsset(assetId: string | undefined) {
  return useApiResource<AssetDto>(assetId ? `/api/assets/${assetId}` : null);
}
export const createAssetRequest = (body: CreateAssetRequest): Promise<ApiResult<AssetDto>> => apiPost<AssetDto>("/api/assets", body);
export const updateAssetRequest = (id: string, body: UpdateAssetRequest): Promise<ApiResult<AssetDto>> => apiPatch<AssetDto>(`/api/assets/${id}`, body);
export const setAssetStatusRequest = (id: string, body: SetAssetStatusRequest): Promise<ApiResult<AssetDto>> => apiPost<AssetDto>(`/api/assets/${id}/status`, body);

export function useAssetHistory(assetId: string | undefined) {
  return useApiResource<AssetHistoryEventDto[]>(assetId ? `/api/assets/${assetId}/history` : null);
}
export function useAssetAuditFeed() {
  return useApiResource<AssetHistoryEventDto[]>("/api/assets/audit");
}

// ── Assignments ──────────────────────────────────────────────────────────

export function useAssetAssignments(filters: { assetId?: string; staffId?: string; status?: "active" | "returned" } = {}) {
  return useApiList<AssetAssignmentDto>(`/api/assets/assignments${buildQuery(filters)}`);
}
export const assignAssetRequest = (assetId: string, body: Omit<AssignAssetRequest, "assetId">): Promise<ApiResult<AssetAssignmentDto>> => apiPost<AssetAssignmentDto>(`/api/assets/${assetId}/assign`, body);
export const returnAssetRequest = (assignmentId: string): Promise<ApiResult<AssetAssignmentDto>> => apiPost<AssetAssignmentDto>(`/api/assets/assignments/${assignmentId}/return`, {});

// ── Maintenance ──────────────────────────────────────────────────────────

export function useAssetMaintenance(filters: { assetId?: string; status?: string } = {}) {
  return useApiList<AssetMaintenanceDto>(`/api/assets/maintenance${buildQuery(filters)}`);
}
export const openMaintenanceRequest = (body: OpenMaintenanceRequest): Promise<ApiResult<AssetMaintenanceDto>> => apiPost<AssetMaintenanceDto>("/api/assets/maintenance", body);
export const completeMaintenanceRequest = (recordId: string, body: CompleteMaintenanceRequest = {}): Promise<ApiResult<AssetMaintenanceDto>> => apiPost<AssetMaintenanceDto>(`/api/assets/maintenance/${recordId}/complete`, body);

// ── Dashboard ────────────────────────────────────────────────────────────

export function useAssetDashboard() {
  return useApiResource<AssetDashboardDto>("/api/assets/dashboard");
}
