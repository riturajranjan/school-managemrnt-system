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

export const apiGet = <T>(url: string) => request<T>("GET", url);
export const apiPost = <T>(url: string, body?: unknown) => request<T>("POST", url, body);
export const apiPatch = <T>(url: string, body?: unknown) => request<T>("PATCH", url, body);
export const apiDelete = <T>(url: string) => request<T>("DELETE", url);
