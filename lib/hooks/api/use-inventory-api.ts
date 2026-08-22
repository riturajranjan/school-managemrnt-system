"use client";

// Real client hooks for Inventory Management (Phase 9O). Reads/writes the
// live /api/inventory/* endpoints — no mock store, no client-computed stock.
import { apiPatch, apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type {
  AdjustStockRequest,
  CreateInventoryItemRequest,
  CreateInventoryLocationRequest,
  InventoryDashboardDto,
  InventoryIssueDto,
  InventoryItemDto,
  InventoryLocationDto,
  InventoryMovementDto,
  InventoryTransferDto,
  IssueStockRequest,
  ReceiveStockRequest,
  ReturnIssueRequest,
  TransferStockRequest,
  UpdateInventoryItemRequest,
} from "@/lib/api/contracts";

// ── Items ────────────────────────────────────────────────────────────────

export function useInventoryItems(filters: { search?: string; status?: string; category?: string } = {}) {
  return useApiList<InventoryItemDto>(`/api/inventory/items${buildQuery(filters)}`);
}
export function useInventoryItem(itemId: string | undefined) {
  return useApiResource<InventoryItemDto>(itemId ? `/api/inventory/items/${itemId}` : null);
}
export const createInventoryItemRequest = (body: CreateInventoryItemRequest): Promise<ApiResult<InventoryItemDto>> => apiPost<InventoryItemDto>("/api/inventory/items", body);
export const updateInventoryItemRequest = (id: string, body: UpdateInventoryItemRequest): Promise<ApiResult<InventoryItemDto>> => apiPatch<InventoryItemDto>(`/api/inventory/items/${id}`, body);

export function useInventoryItemMovements(itemId: string | undefined) {
  return useApiResource<InventoryMovementDto[]>(itemId ? `/api/inventory/items/${itemId}/movements` : null);
}

export function useInventoryCategories() {
  return useApiResource<{ category: string; count: number }[]>("/api/inventory/categories");
}

// ── Locations ────────────────────────────────────────────────────────────

export function useInventoryLocations() {
  return useApiList<InventoryLocationDto>("/api/inventory/locations");
}
export const createInventoryLocationRequest = (body: CreateInventoryLocationRequest): Promise<ApiResult<InventoryLocationDto>> => apiPost<InventoryLocationDto>("/api/inventory/locations", body);

// ── Movements / Receipts / Adjustments ───────────────────────────────────

export function useInventoryMovements(filters: { itemId?: string; locationId?: string; movementType?: string; from?: string; to?: string; page?: number } = {}) {
  return useApiList<InventoryMovementDto>(`/api/inventory/movements${buildQuery(filters)}`);
}
export const receiveStockRequest = (body: ReceiveStockRequest): Promise<ApiResult<InventoryMovementDto>> => apiPost<InventoryMovementDto>("/api/inventory/receipts", body);
export const adjustStockRequest = (body: AdjustStockRequest): Promise<ApiResult<InventoryMovementDto>> => apiPost<InventoryMovementDto>("/api/inventory/adjustments", body);

// ── Issues / Returns ─────────────────────────────────────────────────────

export function useInventoryIssues(filters: { status?: string; outstandingOnly?: boolean } = {}) {
  const { outstandingOnly, ...rest } = filters;
  return useApiList<InventoryIssueDto>(`/api/inventory/issues${buildQuery({ ...rest, outstandingOnly: outstandingOnly ? "true" : undefined })}`);
}
export const issueStockRequest = (body: IssueStockRequest): Promise<ApiResult<InventoryIssueDto>> => apiPost<InventoryIssueDto>("/api/inventory/issues", body);
export const returnIssueRequest = (id: string, body: ReturnIssueRequest): Promise<ApiResult<InventoryIssueDto>> => apiPost<InventoryIssueDto>(`/api/inventory/issues/${id}/return`, body);

// ── Transfers ────────────────────────────────────────────────────────────

export function useInventoryTransfers(filters: { itemId?: string } = {}) {
  return useApiList<InventoryTransferDto>(`/api/inventory/transfers${buildQuery(filters)}`);
}
export const transferStockRequest = (body: TransferStockRequest): Promise<ApiResult<InventoryTransferDto>> => apiPost<InventoryTransferDto>("/api/inventory/transfers", body);

// ── Dashboard ────────────────────────────────────────────────────────────

export function useInventoryDashboard() {
  return useApiResource<InventoryDashboardDto>("/api/inventory/dashboard");
}
