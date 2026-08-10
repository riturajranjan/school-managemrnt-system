"use client";

// Small client-side data-loading hooks over the standard API envelope. They
// expose real loading / error / success states (no fake delays, no mock
// fallback — a failed request surfaces the real error). Prefer these thin
// hooks in migrated Phase-4 pages instead of the in-memory store.
//
// State is only ever updated inside the async resolution (never synchronously in
// the effect body) — stale-while-revalidate on refetch, matching the codebase's
// fetch-in-effect convention.
import { useCallback, useEffect, useState } from "react";
import { apiGet, type ApiResult } from "@/lib/api/client";

export type ListMeta = { page: number; pageSize: number; total: number; totalPages: number };

type ListState<T> = {
  data: T[];
  meta: ListMeta | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

/** GET a list endpoint (`{ success, data, meta }`). Re-fetches whenever `url` changes. */
export function useApiList<T>(url: string): ListState<T> {
  const [state, setState] = useState<{ data: T[]; meta: ListMeta | null; loading: boolean; error: string | null }>({
    data: [],
    meta: null,
    loading: true,
    error: null,
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiGet<T[]>(url).then((res: ApiResult<T[]>) => {
      if (cancelled) return;
      if (res.success) setState({ data: res.data, meta: res.meta ?? null, loading: false, error: null });
      else setState({ data: [], meta: null, loading: false, error: res.error.message });
    });
    return () => {
      cancelled = true;
    };
  }, [url, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}

type ResourceState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
};

/** GET a single resource (`{ success, data }`). `url` may be null to skip fetching. */
export function useApiResource<T>(url: string | null): ResourceState<T> {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>({
    data: null,
    loading: Boolean(url),
    error: null,
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    apiGet<T>(url).then((res: ApiResult<T>) => {
      if (cancelled) return;
      if (res.success) setState({ data: res.data, loading: false, error: null });
      else setState({ data: null, loading: false, error: res.error.message });
    });
    return () => {
      cancelled = true;
    };
  }, [url, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}

type MutationState = { loading: boolean; error: string | null };

/**
 * Wrap an async API call (apiPost/apiPatch/apiDelete) with loading/error state.
 * `run` resolves to the ApiResult so callers can branch on success and read data.
 */
export function useApiMutation<TArgs extends unknown[], TData>(
  fn: (...args: TArgs) => Promise<ApiResult<TData>>,
): MutationState & { run: (...args: TArgs) => Promise<ApiResult<TData>>; reset: () => void } {
  const [state, setState] = useState<MutationState>({ loading: false, error: null });
  const run = useCallback(
    async (...args: TArgs) => {
      setState({ loading: true, error: null });
      const res = await fn(...args);
      setState({ loading: false, error: res.success ? null : res.error.message });
      return res;
    },
    [fn],
  );
  const reset = useCallback(() => setState({ loading: false, error: null }), []);
  return { ...state, run, reset };
}

/** Build a query string from a params object, omitting empty values. */
export function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}
