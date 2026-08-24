// Tiny typed fetch helper for the standard API envelope. Same-origin so the
// httpOnly session cookie is sent automatically. No SDK layer — just JSON in /
// out with a normalized result.
export type ApiResult<T> =
  | { success: true; data: T; meta?: { page: number; pageSize: number; total: number; totalPages: number } }
  | { success: false; error: { code: string; message: string } };

async function request<T>(method: string, url: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: body !== undefined ? { "content-type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json()) as ApiResult<T>;
    return json;
  } catch {
    return { success: false, error: { code: "NETWORK_ERROR", message: "Network request failed" } };
  }
}

// GET is idempotent, so concurrent callers asking for the exact same URL
// share one in-flight request instead of each firing their own. This is what
// actually collapses duplicate requests regardless of *why* a caller re-runs
// (React Strict Mode's synthetic remount, an animated-transition remount, or
// several components legitimately wanting the same resource at once) — fixing
// the trigger site-by-site doesn't help if the fetch primitive itself always
// dials out. Scoped to GET only; mutations must never be deduped this way.
const inFlightGets = new Map<string, Promise<ApiResult<unknown>>>();

export function apiGet<T>(url: string): Promise<ApiResult<T>> {
  const existing = inFlightGets.get(url);
  if (existing) return existing as Promise<ApiResult<T>>;
  const promise = request<T>("GET", url).finally(() => {
    inFlightGets.delete(url);
  });
  inFlightGets.set(url, promise as Promise<ApiResult<unknown>>);
  return promise;
}

export const apiPost = <T>(url: string, body?: unknown) => request<T>("POST", url, body);
export const apiPatch = <T>(url: string, body?: unknown) => request<T>("PATCH", url, body);
export const apiPut = <T>(url: string, body?: unknown) => request<T>("PUT", url, body);
export const apiDelete = <T>(url: string) => request<T>("DELETE", url);
