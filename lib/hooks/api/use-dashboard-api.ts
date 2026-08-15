"use client";

// Real client hook for the school-side Main Dashboard (Phase 9A).
// GET /api/dashboard — no mock store, no localStorage.
import { useApiResource } from "./use-api";
import type { SchoolDashboardSummaryDto } from "@/lib/api/contracts";

export function useSchoolDashboard() {
  return useApiResource<SchoolDashboardSummaryDto>("/api/dashboard");
}
