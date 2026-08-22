"use client";

// Real client hooks for Cafeteria / Meal Management (Phase 9T). Reads/
// writes the live /api/cafeteria/* endpoints — no mock db.menuItems/
// weeklyMenu/cafeteriaOrders.
import { apiPatch, apiPost, apiPut, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type {
  CafeteriaDashboardDto,
  CafeteriaItemDto,
  CafeteriaLocationDto,
  CafeteriaMealRecordDto,
  CafeteriaMenuDetailDto,
  CafeteriaMenuDto,
  CreateCafeteriaItemRequest,
  CreateCafeteriaLocationRequest,
  CreateCafeteriaMenuRequest,
  RecordCafeteriaMealRequest,
  SetCafeteriaMenuItemsRequest,
  StudentCafeteriaProfileDto,
  UpdateCafeteriaItemRequest,
  UpdateCafeteriaLocationRequest,
} from "@/lib/api/contracts";

// ── Locations ────────────────────────────────────────────────────────────

export function useCafeteriaLocations(filters: { status?: string } = {}) {
  return useApiList<CafeteriaLocationDto>(`/api/cafeteria/locations${buildQuery(filters)}`);
}
export const createCafeteriaLocationRequest = (body: CreateCafeteriaLocationRequest): Promise<ApiResult<CafeteriaLocationDto>> => apiPost<CafeteriaLocationDto>("/api/cafeteria/locations", body);
export const updateCafeteriaLocationRequest = (id: string, body: UpdateCafeteriaLocationRequest): Promise<ApiResult<CafeteriaLocationDto>> => apiPatch<CafeteriaLocationDto>(`/api/cafeteria/locations/${id}`, body);

// ── Items ────────────────────────────────────────────────────────────────

export function useCafeteriaItems(filters: { status?: string; search?: string } = {}) {
  return useApiList<CafeteriaItemDto>(`/api/cafeteria/items${buildQuery(filters)}`);
}
export function useCafeteriaItem(itemId: string | undefined) {
  return useApiResource<CafeteriaItemDto>(itemId ? `/api/cafeteria/items/${itemId}` : null);
}
export const createCafeteriaItemRequest = (body: CreateCafeteriaItemRequest): Promise<ApiResult<CafeteriaItemDto>> => apiPost<CafeteriaItemDto>("/api/cafeteria/items", body);
export const updateCafeteriaItemRequest = (id: string, body: UpdateCafeteriaItemRequest): Promise<ApiResult<CafeteriaItemDto>> => apiPatch<CafeteriaItemDto>(`/api/cafeteria/items/${id}`, body);

// ── Menus ────────────────────────────────────────────────────────────────

export function useCafeteriaMenus(filters: { locationId?: string; date?: string; dateFrom?: string; dateTo?: string; mealType?: string } = {}) {
  return useApiList<CafeteriaMenuDto>(`/api/cafeteria/menus${buildQuery(filters)}`);
}
export function useCafeteriaMenu(menuId: string | undefined) {
  return useApiResource<CafeteriaMenuDetailDto>(menuId ? `/api/cafeteria/menus/${menuId}` : null);
}
export const createCafeteriaMenuRequest = (body: CreateCafeteriaMenuRequest): Promise<ApiResult<CafeteriaMenuDto>> => apiPost<CafeteriaMenuDto>("/api/cafeteria/menus", body);
export const setCafeteriaMenuItemsRequest = (menuId: string, body: SetCafeteriaMenuItemsRequest): Promise<ApiResult<CafeteriaMenuDetailDto>> => apiPut<CafeteriaMenuDetailDto>(`/api/cafeteria/menus/${menuId}/items`, body);

// ── Meal service ─────────────────────────────────────────────────────────

export function useCafeteriaMeals(filters: { menuId?: string; studentId?: string; staffId?: string; dateFrom?: string; dateTo?: string; page?: number; pageSize?: number } = {}) {
  return useApiList<CafeteriaMealRecordDto>(`/api/cafeteria/meals${buildQuery(filters)}`);
}
export const recordCafeteriaMealRequest = (body: RecordCafeteriaMealRequest): Promise<ApiResult<CafeteriaMealRecordDto>> => apiPost<CafeteriaMealRecordDto>("/api/cafeteria/meals", body);

// ── Dashboard ────────────────────────────────────────────────────────────

export function useCafeteriaDashboard() {
  return useApiResource<CafeteriaDashboardDto>("/api/cafeteria/dashboard");
}

// ── Student 360 ──────────────────────────────────────────────────────────

export function useStudentCafeteriaProfile(studentId: string | undefined) {
  return useApiResource<StudentCafeteriaProfileDto>(studentId ? `/api/students/${studentId}/cafeteria` : null);
}
