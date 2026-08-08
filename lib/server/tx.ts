import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@/lib/generated/prisma/client";

// ---------------------------------------------------------------------------
// Transaction pattern. Multi-write workflows that must be atomic (later:
// admission→student, payment→receipt→ledger, promotion, result publication)
// run through runInTransaction and thread the `tx` client into every service
// call so they commit or roll back together. Establishing the pattern now;
// no such workflow is implemented in Phase 16.
// ---------------------------------------------------------------------------

// Accepts either the base client or an interactive-transaction client, so
// services can be called both standalone and inside a transaction.
export type PrismaTx = typeof prisma | Prisma.TransactionClient;

export async function runInTransaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn);
}
