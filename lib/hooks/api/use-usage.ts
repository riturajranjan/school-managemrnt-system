"use client";

// Real-data usage & limits hooks (Super Admin SA-4G). Usage is derived live from
// real DB rows vs Plan limits via /api/super-admin/usage — no mock counters, no
// fake progress, no localStorage.
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type { SchoolUsageDto, UsageSummaryDto } from "@/lib/api/contracts";

export type UsageListQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  state?: string;
  plan?: string;
  sort?: string;
  order?: "asc" | "desc";
};

export function useUsageList(query: UsageListQuery) {
  const url = `/api/super-admin/usage${buildQuery({
    page: query.page,
    pageSize: query.pageSize,
    search: query.search,
    state: query.state && query.state !== "all" ? query.state : undefined,
    plan: query.plan,
    sort: query.sort,
    order: query.order,
  })}`;
  return useApiList<SchoolUsageDto>(url);
}

export function useSchoolUsage(schoolId: string | undefined) {
  return useApiResource<SchoolUsageDto>(schoolId ? `/api/super-admin/usage/${schoolId}` : null);
}

export function useUsageSummary() {
  return useApiResource<UsageSummaryDto>("/api/super-admin/usage/summary");
}
