"use client";

// Real client hooks for Features / Domains / Branding (Super Admin SA-4L). All
// read/write the live /api/super-admin/* endpoints — no mock store, no db.saas.
import { apiDelete, apiPatch, apiPost, type ApiResult } from "@/lib/api/client";
import { useApiList, useApiResource } from "./use-api";
import type { SchoolBrandingDto, SchoolDomainDto, SchoolFeaturesDto } from "@/lib/api/contracts";

// --- Features ---
export function useSchoolFeatures(schoolId: string | undefined) {
  return useApiResource<SchoolFeaturesDto>(schoolId ? `/api/super-admin/features/${schoolId}` : null);
}
export const patchFeatureOverrideRequest = (
  schoolId: string,
  body: { featureKey: string; enabled: boolean | null; reason?: string },
): Promise<ApiResult<SchoolFeaturesDto>> => apiPatch<SchoolFeaturesDto>(`/api/super-admin/features/${schoolId}`, body);

// --- Domains ---
export function useDomains(schoolId: string | undefined) {
  const qs = schoolId ? `?school=${encodeURIComponent(schoolId)}` : "";
  return useApiList<SchoolDomainDto>(`/api/super-admin/domains${qs}`);
}
export const createDomainRequest = (body: {
  schoolId: string;
  hostname: string;
  type?: "subdomain" | "custom";
}): Promise<ApiResult<SchoolDomainDto>> => apiPost<SchoolDomainDto>("/api/super-admin/domains", body);
export const setDomainStatusRequest = (
  id: string,
  status: "pending" | "verified" | "failed" | "disabled",
): Promise<ApiResult<SchoolDomainDto>> => apiPost<SchoolDomainDto>(`/api/super-admin/domains/${id}/status`, { status });
export const deleteDomainRequest = (id: string): Promise<ApiResult<{ id: string }>> =>
  apiDelete<{ id: string }>(`/api/super-admin/domains/${id}`);

// --- Branding ---
export function useBranding(schoolId: string | undefined) {
  return useApiResource<SchoolBrandingDto>(schoolId ? `/api/super-admin/branding/${schoolId}` : null);
}
export const updateBrandingRequest = (
  schoolId: string,
  body: Partial<Omit<SchoolBrandingDto, "school" | "tenant" | "updatedAt">>,
): Promise<ApiResult<SchoolBrandingDto>> => apiPatch<SchoolBrandingDto>(`/api/super-admin/branding/${schoolId}`, body);
