"use client";

// Real client hook for My Day (Phase 9A). GET /api/my-day — no mock store,
// no fake CURRENT_TEACHER_ID identity, no localStorage.
import { useApiResource } from "./use-api";
import type { MyDayDto } from "@/lib/api/contracts";

export function useMyDay() {
  return useApiResource<MyDayDto>("/api/my-day");
}
