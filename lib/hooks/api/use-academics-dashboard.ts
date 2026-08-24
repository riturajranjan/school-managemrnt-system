"use client";

// Real client hook for the Academics hub. GET /api/academics/dashboard — no
// mock store, no localStorage.
import { useApiResource } from "./use-api";
import type { AcademicsDashboardDto } from "@/lib/api/contracts";

export function useAcademicsDashboard() {
  return useApiResource<AcademicsDashboardDto>("/api/academics/dashboard");
}
