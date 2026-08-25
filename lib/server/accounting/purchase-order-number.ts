// Race-safe, school-scoped PO numbering — the exact same atomic
// `UPDATE ... SET counter = counter + 1 RETURNING counter` strategy as
// entry-number.ts (Phase 9G). Format: PO-<year>-<counter, zero-padded to 4>.
import { Prisma } from "@/lib/generated/prisma/client";

export async function nextPurchaseOrderNumber(tx: Prisma.TransactionClient, schoolId: string, year: number): Promise<string> {
  await tx.purchaseOrderCounter.upsert({ where: { schoolId }, create: { schoolId, counter: 0 }, update: {} });
  const rows = await tx.$queryRaw<{ counter: number }[]>`
    UPDATE purchase_order_counters SET counter = counter + 1 WHERE "schoolId" = ${schoolId} RETURNING counter
  `;
  return `PO-${year}-${String(rows[0].counter).padStart(4, "0")}`;
}
