"use client";

// Real-data tenant-health hooks (Super Admin SA-4F). Health is derived
// server-side from real DB signals via /api/super-admin/health — no mock store,
// no fake scores, no localStorage.
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type { HealthSummaryDto, TenantHealthDto } from "@/lib/api/contracts";

export type HealthListQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  healthState?: string;
  schoolStatus?: string;
  subscriptionStatus?: string;
  sort?: string;
  order?: "asc" | "desc";
};

export function useTenantHealthList(query: HealthListQuery) {
  const url = `/api/super-admin/health${buildQuery({
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
    healthState: query.healthState && query.healthState !== "all" ? query.healthState : undefined,
    schoolStatus: query.schoolStatus,
    subscriptionStatus: query.subscriptionStatus,
    sort: query.sort,
    order: query.order,
  })}`;
  return useApiList<TenantHealthDto>(url);
}

export function useHealthSummary() {
  return useApiResource<HealthSummaryDto>("/api/super-admin/health/summary");
}
