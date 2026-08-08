// ---------------------------------------------------------------------------
// Typed application errors. Throw these from services/guards instead of raw
// strings so callers (Route Handlers, Server Actions) can map them to safe
// user-facing responses via toErrorResponse(). DB internals are never leaked.
// ---------------------------------------------------------------------------

export type AppErrorCode =
  | "VALIDATION"
  | "AUTHENTICATION"
  | "AUTHORIZATION"
  | "NOT_FOUND"
  | "CONFLICT"
  | "BUSINESS_RULE"
  | "INTERNAL";

export abstract class AppError extends Error {
  abstract readonly code: AppErrorCode;
  abstract readonly httpStatus: number;
  /** Safe to show to end users. Never include DB/internal detail here. */
  readonly publicMessage: string;
  /** Optional non-sensitive detail for logs / structured responses. */
  readonly details?: Record<string, unknown>;

  constructor(publicMessage: string, details?: Record<string, unknown>) {
    super(publicMessage);
    this.name = new.target.name;
    this.publicMessage = publicMessage;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  readonly code = "VALIDATION" as const;
  readonly httpStatus = 422;
}

export class AuthenticationError extends AppError {
  readonly code = "AUTHENTICATION" as const;
  readonly httpStatus = 401;
  constructor(publicMessage = "You must be signed in.", details?: Record<string, unknown>) {
    super(publicMessage, details);
  }
}

export class AuthorizationError extends AppError {
  readonly code = "AUTHORIZATION" as const;
  readonly httpStatus = 403;
  constructor(publicMessage = "You do not have access to this resource.", details?: Record<string, unknown>) {
    super(publicMessage, details);
  }
}

export class NotFoundError extends AppError {
  readonly code = "NOT_FOUND" as const;
  readonly httpStatus = 404;
  constructor(publicMessage = "Not found.", details?: Record<string, unknown>) {
    super(publicMessage, details);
  }
}

export class ConflictError extends AppError {
  readonly code = "CONFLICT" as const;
  readonly httpStatus = 409;
}

export class BusinessRuleError extends AppError {
  readonly code = "BUSINESS_RULE" as const;
  readonly httpStatus = 422;
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

export type SafeErrorResponse = {
  error: { code: AppErrorCode; message: string; details?: Record<string, unknown> };
};

// Maps any thrown value to a safe response shape. Unknown/DB errors collapse to
// a generic INTERNAL message — the real error should be logged server-side by
// the caller, never returned to the client.
export function toErrorResponse(err: unknown): { status: number; body: SafeErrorResponse } {
  if (isAppError(err)) {
    return {
      status: err.httpStatus,
      body: { error: { code: err.code, message: err.publicMessage, details: err.details } },
    };
  }
  return {
    status: 500,
    body: { error: { code: "INTERNAL", message: "Something went wrong. Please try again." } },
  };
}
