import "server-only";
import { Prisma } from "@/lib/generated/prisma/client";
import { ConflictError, NotFoundError } from "./errors";

// Maps low-level Prisma error codes to safe typed AppErrors so services never
// leak DB internals. Extend as new codes need friendly handling.
export function mapPrismaError(e: unknown, opts?: { conflictMessage?: string; notFoundMessage?: string }): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") throw new ConflictError(opts?.conflictMessage ?? "A record with these details already exists.");
    if (e.code === "P2025") throw new NotFoundError(opts?.notFoundMessage ?? "Record not found.");
  }
  throw e;
}

export function isUniqueConstraintError(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}
