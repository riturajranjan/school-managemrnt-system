"use client";

// Real-data onboarding hooks (Super Admin SA-3). Read/write the live
// /api/super-admin/onboarding endpoints — no mock store, no localStorage state.
import { apiPatch, apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type { OnboardingDto } from "@/lib/api/contracts";

export type OnboardingListQuery = { page?: number; pageSize?: number; search?: string; status?: string };

export function useOnboardingList(query: OnboardingListQuery) {
  const url = `/api/super-admin/onboarding${buildQuery({
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
    status: query.status && query.status !== "all" ? query.status : undefined,
  })}`;
  return useApiList<OnboardingDto>(url);
}

export function useOnboarding(schoolId: string | undefined) {
  return useApiResource<OnboardingDto>(schoolId ? `/api/super-admin/schools/${schoolId}/onboarding` : null);
}

export const updateOnboardingRequest = (
  schoolId: string,
  body: { completedSteps?: string[]; currentStep?: string },
): Promise<ApiResult<OnboardingDto>> => apiPatch<OnboardingDto>(`/api/super-admin/schools/${schoolId}/onboarding`, body);

export const completeOnboardingRequest = (schoolId: string): Promise<ApiResult<OnboardingDto>> =>
  apiPost<OnboardingDto>(`/api/super-admin/schools/${schoolId}/onboarding/complete`, {});
