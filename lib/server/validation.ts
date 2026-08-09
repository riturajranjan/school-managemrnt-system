// Server-side validation convention (foundation only — no business schemas yet).
//
// Validation model for this codebase:
//
//   • Client validation (react-hook-form + @hookform/resolvers/zod) is for UX:
//     fast feedback, but never trusted.
//   • Server validation is AUTHORITATIVE. Every server action / API handler / job
//     re-validates its raw input with Zod before touching the database. The
//     client having "already validated" is irrelevant on the server.
//
// Business-module schemas (students, fees, …) will live next to their modules in
// later phases and be parsed through the helpers below at the trust boundary.

import { z } from "zod";
import { ValidationError } from "./errors";

/**
 * Parse untrusted input against a Zod schema at the server trust boundary.
 * Throws a typed {@link ValidationError} (400) with flattened field issues on
 * failure, so callers get one consistent error shape.
 */
export function parseInput<Schema extends z.ZodType>(
  schema: Schema,
  input: unknown,
): z.infer<Schema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError("Validation failed", z.flattenError(result.error));
  }
  return result.data;
}
