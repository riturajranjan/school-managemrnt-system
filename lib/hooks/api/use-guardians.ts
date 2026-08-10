"use client";

// Real-data guardian hooks (Backend Phase 4). These read the live /api/guardians
// endpoints — the guardian directory and profile no longer depend on the mock store.
import { buildQuery, useApiList, useApiResource } from "./use-api";
import type { GuardianDto } from "@/lib/api/contracts";

/** Guardian directory. Search is server-backed; a generous page size loads the
 *  current tenant's guardians for the directory view. */
export function useGuardianDirectory(search: string) {
  return useApiList<GuardianDto>(`/api/guardians${buildQuery({ search, pageSize: 100 })}`);
}

/** A single guardian with their linked children. Pass null to skip fetching. */
export function useGuardian(guardianId: string | undefined) {
  return useApiResource<GuardianDto>(guardianId ? `/api/guardians/${guardianId}` : null);
}
