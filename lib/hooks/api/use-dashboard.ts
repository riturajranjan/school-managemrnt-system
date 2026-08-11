"use client";

// Real Super Admin dashboard summary hook (SA-4J). Real school lifecycle counts
// from /api/super-admin/dashboard/summary — no mock store.
import { useApiResource } from "./use-api";
import type { DashboardSummaryDto } from "@/lib/api/contracts";

export function useDashboardSummary() {
  return useApiResource<DashboardSummaryDto>("/api/super-admin/dashboard/summary");
}
