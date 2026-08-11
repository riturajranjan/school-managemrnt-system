"use client";

// Real Super Admin global-search hook (SA-4H). Hits GET /api/super-admin/search
// with the (already-debounced) query. `useApiResource` cancels stale in-flight
// results on query change, so an older response never overwrites a newer query.
// Below the minimum query length we skip the request entirely (url = null).
import { useApiResource } from "./use-api";
import type { GlobalSearchDto } from "@/lib/api/contracts";

export const MIN_SEARCH_LENGTH = 2;

export function useGlobalSearch(query: string) {
  const q = query.trim();
  const url = q.length >= MIN_SEARCH_LENGTH ? `/api/super-admin/search?q=${encodeURIComponent(q)}` : null;
  return useApiResource<GlobalSearchDto>(url);
}
