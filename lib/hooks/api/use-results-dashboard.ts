"use client";

// Real client hook for the Results hub. GET /api/results/dashboard — no mock
// store, no localStorage.
import { useApiResource } from "./use-api";
import type { ResultsDashboardDto } from "@/lib/api/contracts";

export function useResultsDashboard() {
  return useApiResource<ResultsDashboardDto>("/api/results/dashboard");
}
