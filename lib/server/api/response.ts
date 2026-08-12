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
  | "PLAN_CODE_EXISTS"
  | "SUBSCRIPTION_EXISTS"
  | "INVALID_PLAN"
  | "INVALID_STATUS_TRANSITION"
  | "INVOICE_NOT_FOUND"
  | "INVOICE_ALREADY_EXISTS"
  | "INVALID_INVOICE_TRANSITION"
  | "SUBSCRIPTION_NOT_BILLABLE"
  | "INVOICE_NOT_OPEN"
  | "PAYMENT_NOT_FOUND"
  | "PAYMENT_EXCEEDS_AMOUNT_DUE"
  | "PAYMENT_ALREADY_REVERSED"
  | "TICKET_NOT_FOUND"
  | "INVALID_TICKET_TRANSITION"
  | "INVALID_ASSIGNEE"
  | "INVALID_SCHOOL"
  | "INVALID_ROLE"
  | "INVALID_BRANCH"
  | "INVALID_SESSION"
  | "IMPERSONATION_ACTIVE"
  | "IMPERSONATION_TARGET_INELIGIBLE"
  | "ATTENDANCE_SESSION_NOT_FOUND"
  | "ATTENDANCE_ALREADY_LOCKED"
  | "INVALID_ATTENDANCE_TRANSITION"
  | "STUDENT_NOT_IN_SECTION"
  | "ATTENDANCE_DATE_INVALID"
  | "FEATURE_DISABLED"
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
  PLAN_CODE_EXISTS: 409,
  SUBSCRIPTION_EXISTS: 409,
  INVALID_PLAN: 400,
  INVALID_STATUS_TRANSITION: 409,
  INVOICE_NOT_FOUND: 404,
  INVOICE_ALREADY_EXISTS: 409,
  INVALID_INVOICE_TRANSITION: 409,
  SUBSCRIPTION_NOT_BILLABLE: 409,
  INVOICE_NOT_OPEN: 409,
  PAYMENT_NOT_FOUND: 404,
  PAYMENT_EXCEEDS_AMOUNT_DUE: 409,
  PAYMENT_ALREADY_REVERSED: 409,
  TICKET_NOT_FOUND: 404,
  INVALID_TICKET_TRANSITION: 409,
  INVALID_ASSIGNEE: 400,
  INVALID_SCHOOL: 400,
  INVALID_ROLE: 400,
  INVALID_BRANCH: 400,
  INVALID_SESSION: 400,
  IMPERSONATION_ACTIVE: 409,
  IMPERSONATION_TARGET_INELIGIBLE: 409,
  ATTENDANCE_SESSION_NOT_FOUND: 404,
  ATTENDANCE_ALREADY_LOCKED: 409,
  INVALID_ATTENDANCE_TRANSITION: 409,
  STUDENT_NOT_IN_SECTION: 400,
  ATTENDANCE_DATE_INVALID: 400,
  FEATURE_DISABLED: 403,
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
