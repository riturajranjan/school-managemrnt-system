"use client";

// Real client hooks for Add-ons + Marketplace (Super Admin SA-4M). All read/write
// the live /api/super-admin/* endpoints — no mock store, no db.saas.
import { apiDelete, apiPost, type ApiResult } from "@/lib/api/client";
import { useApiList, useApiResource } from "./use-api";
import type {
  AddOnDto,
  MarketplaceAppDto,
  SchoolAddOnDto,
  SchoolMarketplaceInstallationDto,
} from "@/lib/api/contracts";

// --- Add-ons ---
export function useAddOns() {
  return useApiList<AddOnDto>("/api/super-admin/addons");
}
// School-scoped list via useApiResource<[]> so a null url skips the fetch until a
// school is selected (the array is returned directly in the `data` envelope).
export function useSchoolAddOns(schoolId: string | undefined) {
  return useApiResource<SchoolAddOnDto[]>(schoolId ? `/api/super-admin/schools/${schoolId}/addons` : null);
}
export const assignAddOnRequest = (schoolId: string, addOnId: string): Promise<ApiResult<SchoolAddOnDto>> =>
  apiPost<SchoolAddOnDto>(`/api/super-admin/schools/${schoolId}/addons`, { addOnId });
export const removeSchoolAddOnRequest = (schoolId: string, assignmentId: string): Promise<ApiResult<SchoolAddOnDto>> =>
  apiDelete<SchoolAddOnDto>(`/api/super-admin/schools/${schoolId}/addons/${assignmentId}`);
export const setAddOnStatusRequest = (id: string, status: "draft" | "active" | "archived"): Promise<ApiResult<AddOnDto>> =>
  apiPost<AddOnDto>(`/api/super-admin/addons/${id}/status`, { status });

// --- Marketplace ---
export function useMarketplaceApps() {
  return useApiList<MarketplaceAppDto>("/api/super-admin/marketplace");
}
export function useSchoolInstalls(schoolId: string | undefined) {
  return useApiResource<SchoolMarketplaceInstallationDto[]>(schoolId ? `/api/super-admin/schools/${schoolId}/marketplace` : null);
}
export const installAppRequest = (schoolId: string, appId: string): Promise<ApiResult<SchoolMarketplaceInstallationDto>> =>
  apiPost<SchoolMarketplaceInstallationDto>(`/api/super-admin/schools/${schoolId}/marketplace/${appId}/install`, {});
export const disableInstallRequest = (schoolId: string, appId: string): Promise<ApiResult<SchoolMarketplaceInstallationDto>> =>
  apiPost<SchoolMarketplaceInstallationDto>(`/api/super-admin/schools/${schoolId}/marketplace/${appId}/disable`, {});
export const setAppStatusRequest = (id: string, status: "draft" | "active" | "archived"): Promise<ApiResult<MarketplaceAppDto>> =>
  apiPost<MarketplaceAppDto>(`/api/super-admin/marketplace/${id}/status`, { status });
