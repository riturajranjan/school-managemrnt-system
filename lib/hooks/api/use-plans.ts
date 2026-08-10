"use client";

// Real-data plan hooks (Super Admin SA-4A). Read/write the live
// /api/super-admin/plans endpoints — the plan catalog no longer uses the mock store.
import { apiPatch, apiPost, type ApiResult } from "@/lib/api/client";
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type { PlanDto } from "@/lib/api/contracts";

export type PlanListQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  billingInterval?: string;
  sort?: string;
  order?: "asc" | "desc";
};

export function usePlanList(query: PlanListQuery) {
  const url = `/api/super-admin/plans${buildQuery({
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
    status: query.status && query.status !== "all" ? query.status : undefined,
    billingInterval: query.billingInterval && query.billingInterval !== "all" ? query.billingInterval : undefined,
    sort: query.sort,
    order: query.order,
  })}`;
  return useApiList<PlanDto>(url);
}

export function usePlan(planId: string | undefined) {
  return useApiResource<PlanDto>(planId ? `/api/super-admin/plans/${planId}` : null);
}

export const createPlanRequest = (body: unknown): Promise<ApiResult<PlanDto>> =>
  apiPost<PlanDto>("/api/super-admin/plans", body);

export const updatePlanRequest = (id: string, body: unknown): Promise<ApiResult<PlanDto>> =>
  apiPatch<PlanDto>(`/api/super-admin/plans/${id}`, body);

export const setPlanStatusRequest = (id: string, status: "draft" | "active" | "archived"): Promise<ApiResult<PlanDto>> =>
  apiPost<PlanDto>(`/api/super-admin/plans/${id}/status`, { status });

/** Client-side currency formatting — prices are stored structured, not formatted. */
export function formatPlanPrice(price: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(price);
  } catch {
    return `${currency} ${price.toLocaleString("en-IN")}`;
  }
}
