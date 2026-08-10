// Small Route-Handler request helpers: pagination + repeated query params, and
// safe JSON body reading (maps a malformed body to a VALIDATION_ERROR guard).
import { HttpError } from "./guard";

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

export function parsePagination(sp: URLSearchParams): { page: number; pageSize: number } {
  const page = Math.max(1, Number.parseInt(sp.get("page") ?? "1", 10) || 1);
  const rawSize = Number.parseInt(sp.get("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawSize));
  return { page, pageSize };
}

/** Read a repeatable filter param: supports both `?status=a&status=b` and `?status=a,b`. */
export function multiParam(sp: URLSearchParams, key: string): string[] | undefined {
  const all = sp.getAll(key);
  if (all.length === 0) return undefined;
  const values = all.flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean);
  return values.length ? values : undefined;
}

export function singleParam(sp: URLSearchParams, key: string): string | undefined {
  const v = sp.get(key)?.trim();
  return v ? v : undefined;
}

/** Parse a JSON request body, throwing a typed guard on malformed input. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError("VALIDATION_ERROR", "Invalid JSON body");
  }
}
