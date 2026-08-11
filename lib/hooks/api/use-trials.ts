"use client";

// Real-data trial hooks (Super Admin SA-4C). Trials are Subscriptions with a
// trial window; these read/write the live /api/super-admin/trials endpoints —
// no mock store, no fake timers, no localStorage authority.
import { apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type { TrialDto } from "@/lib/api/contracts";

export type TrialListQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  plan?: string;
  state?: string;
  sort?: string;
  order?: "asc" | "desc";
};

export function useTrialList(query: TrialListQuery) {
  const url = `/api/super-admin/trials${buildQuery({
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
    plan: query.plan,
    state: query.state && query.state !== "all" ? query.state : undefined,
    sort: query.sort,
    order: query.order,
  })}`;
  return useApiList<TrialDto>(url);
}

export function useTrial(id: string | undefined) {
  return useApiResource<TrialDto>(id ? `/api/super-admin/trials/${id}` : null);
}

export const extendTrialRequest = (id: string, days: number): Promise<ApiResult<TrialDto>> =>
  apiPost<TrialDto>(`/api/super-admin/trials/${id}/extend`, { days });

export const convertTrialRequest = (id: string): Promise<ApiResult<TrialDto>> =>
  apiPost<TrialDto>(`/api/super-admin/trials/${id}/convert`, {});

export const endTrialRequest = (id: string): Promise<ApiResult<TrialDto>> =>
  apiPost<TrialDto>(`/api/super-admin/trials/${id}/end`, {});
