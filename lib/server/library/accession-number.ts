// Race-safe, school-scoped accession numbering (Phase 9N) — same atomic
// `UPDATE ... RETURNING` strategy as Phase 9I's visitor pass numbering
// (lib/server/visitors/pass-number.ts). Format: ACC-<counter, zero-padded to 6>.
import { Prisma } from "@/lib/generated/prisma/client";

export async function nextAccessionNumber(tx: Prisma.TransactionClient, schoolId: string): Promise<string> {
  await tx.libraryAccessionCounter.upsert({ where: { schoolId }, create: { schoolId, counter: 0 }, update: {} });
  const rows = await tx.$queryRaw<{ counter: number }[]>`
    UPDATE library_accession_counters SET counter = counter + 1 WHERE "schoolId" = ${schoolId} RETURNING counter
  `;
  const counter = rows[0].counter;
  return `ACC-${String(counter).padStart(6, "0")}`;
}
