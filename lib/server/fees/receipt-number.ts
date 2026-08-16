// Race-safe, school-scoped receipt numbering (Phase 9F). `UPDATE ... SET
// counter = counter + 1 RETURNING counter` is a single atomic statement in
// Postgres — two concurrent payments for the same school can never receive
// the same counter value, with no separate row lock required. Format:
// RCP-<schoolCode>-<year>-<counter, zero-padded to 6>. The school-code
// segment is what keeps the number unique across schools despite each
// school's counter independently starting at 1.
import { Prisma } from "@/lib/generated/prisma/client";

export async function nextReceiptNumber(tx: Prisma.TransactionClient, schoolId: string, schoolCode: string, year: number): Promise<string> {
  await tx.feeReceiptCounter.upsert({ where: { schoolId }, create: { schoolId, counter: 0 }, update: {} });
  const rows = await tx.$queryRaw<{ counter: number }[]>`
    UPDATE fee_receipt_counters SET counter = counter + 1 WHERE "schoolId" = ${schoolId} RETURNING counter
  `;
  const counter = rows[0].counter;
  const safeCode = schoolCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "SCH";
  return `RCP-${safeCode}-${year}-${String(counter).padStart(6, "0")}`;
}
