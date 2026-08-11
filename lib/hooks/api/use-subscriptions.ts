"use client";

// Real-data subscription hooks (Super Admin SA-4B). Read/write the live
// /api/super-admin/subscriptions endpoints — subscriptions are real DB rows
// connecting a School + Tenant to a Plan, no mock store.
import { apiPatch, apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type { SubscriptionDto } from "@/lib/api/contracts";

export type SubscriptionListQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  planId?: string;
  sort?: string;
  order?: "asc" | "desc";
};

export function useSubscriptionList(query: SubscriptionListQuery) {
  const url = `/api/super-admin/subscriptions${buildQuery({
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
    status: query.status && query.status !== "all" ? query.status : undefined,
    planId: query.planId,
    sort: query.sort,
    order: query.order,
  })}`;
  return useApiList<SubscriptionDto>(url);
}

export function useSubscription(id: string | undefined) {
  return useApiResource<SubscriptionDto>(id ? `/api/super-admin/subscriptions/${id}` : null);
}

export const createSubscriptionRequest = (body: unknown): Promise<ApiResult<SubscriptionDto>> =>
  apiPost<SubscriptionDto>("/api/super-admin/subscriptions", body);

export const setSubscriptionCancelAtPeriodEnd = (id: string, cancelAtPeriodEnd: boolean): Promise<ApiResult<SubscriptionDto>> =>
  apiPatch<SubscriptionDto>(`/api/super-admin/subscriptions/${id}`, { cancelAtPeriodEnd });

export const setSubscriptionStatusRequest = (
  id: string,
  status: "active" | "past-due" | "cancelled" | "ended",
): Promise<ApiResult<SubscriptionDto>> => apiPost<SubscriptionDto>(`/api/super-admin/subscriptions/${id}/status`, { status });

export const changeSubscriptionPlanRequest = (id: string, planId: string): Promise<ApiResult<SubscriptionDto>> =>
  apiPost<SubscriptionDto>(`/api/super-admin/subscriptions/${id}/change-plan`, { planId });
