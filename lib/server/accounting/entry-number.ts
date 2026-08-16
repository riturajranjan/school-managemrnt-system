// Race-safe, school-scoped journal-entry numbering (Phase 9G) — the exact
// same atomic `UPDATE ... SET counter = counter + 1 RETURNING counter`
// strategy as Phase 9F's fee receipt numbering (lib/server/fees/receipt-number.ts).
// Format: JE-<year>-<counter, zero-padded to 6>.
import { Prisma } from "@/lib/generated/prisma/client";

export async function nextJournalEntryNumber(tx: Prisma.TransactionClient, schoolId: string, year: number): Promise<string> {
  await tx.accountingEntryCounter.upsert({ where: { schoolId }, create: { schoolId, counter: 0 }, update: {} });
  const rows = await tx.$queryRaw<{ counter: number }[]>`
    UPDATE accounting_entry_counters SET counter = counter + 1 WHERE "schoolId" = ${schoolId} RETURNING counter
  `;
  return `JE-${year}-${String(rows[0].counter).padStart(6, "0")}`;
}
