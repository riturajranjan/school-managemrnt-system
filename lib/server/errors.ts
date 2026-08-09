// Minimal typed backend error foundation.
//
// These are intentionally small — a base `AppError` plus a few concrete cases
// the service/API layer will need. Grow this deliberately; do not turn it into
// a large abstraction. Each error carries a stable `code` (for API responses /
// logging) and an HTTP `status` for the future route layer to map onto.

export type AppErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT";

export abstract class AppError extends Error {
  abstract readonly code: AppErrorCode;
  abstract readonly status: number;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    // Restore prototype chain when compiling to older targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Input failed server-side validation. Optional `details` carries field issues. */
export class ValidationError extends AppError {
  readonly code = "VALIDATION_ERROR" as const;
  readonly status = 400;

  constructor(
    message = "Validation failed",
    readonly details?: unknown,
  ) {
    super(message);
  }
}

/** A requested entity does not exist (or is not visible in the current scope). */
export class NotFoundError extends AppError {
  readonly code = "NOT_FOUND" as const;
  readonly status = 404;

  constructor(message = "Resource not found") {
    super(message);
  }
}

/** The request conflicts with current state (e.g. a uniqueness violation). */
export class ConflictError extends AppError {
  readonly code = "CONFLICT" as const;
  readonly status = 409;

  constructor(message = "Resource conflict") {
    super(message);
  }
}

/** Type guard for any of our typed application errors. */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
