// Standard REST response envelope + error codes for Route Handlers.
// Success: { success: true, data, meta? }
// Error:   { success: false, error: { code, message } }
// Never returns raw Prisma objects/errors.
import { NextResponse } from "next/server";

export type ApiErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "DUPLICATE_ADMISSION_NUMBER"
  | "ALREADY_ENROLLED"
  | "INVALID_STAGE_TRANSITION"
  | "IMPORT_VALIDATION_ERROR"
  | "TOO_MANY_ROWS"
  | "SCHOOL_CODE_EXISTS"
  | "SCHOOL_SLUG_EXISTS"
  | "ADMIN_CONFLICT"
  | "INVALID_SESSION_DATES"
  | "ONBOARDING_INCOMPLETE"
  | "INVALID_SCHOOL"
  | "INVALID_ROLE"
  | "INVALID_BRANCH"
  | "INVALID_SESSION"
  | "SERVER_ERROR";

const STATUS: Record<ApiErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  DUPLICATE_ADMISSION_NUMBER: 409,
  ALREADY_ENROLLED: 409,
  INVALID_STAGE_TRANSITION: 409,
  IMPORT_VALIDATION_ERROR: 400,
  TOO_MANY_ROWS: 400,
  SCHOOL_CODE_EXISTS: 409,
  SCHOOL_SLUG_EXISTS: 409,
  ADMIN_CONFLICT: 409,
  INVALID_SESSION_DATES: 400,
  ONBOARDING_INCOMPLETE: 409,
  INVALID_SCHOOL: 400,
  INVALID_ROLE: 400,
  INVALID_BRANCH: 400,
  INVALID_SESSION: 400,
  SERVER_ERROR: 500,
};

export type ListMeta = { page: number; pageSize: number; total: number; totalPages: number };

/** Success envelope. Pass `meta` for list endpoints. */
export function ok<T>(data: T, meta?: ListMeta): NextResponse {
  return NextResponse.json(meta ? { success: true, data, meta } : { success: true, data });
}

/**
 * Error envelope with a safe code + human message and the matching HTTP status.
 * Optional `details` carries field-level issues (e.g. flattened Zod errors) so
 * clients can surface which field failed — never raw Prisma internals.
 */
export function fail(code: ApiErrorCode, message: string, details?: unknown): NextResponse {
  const error = details === undefined ? { code, message } : { code, message, details };
  return NextResponse.json({ success: false, error }, { status: STATUS[code] });
}
