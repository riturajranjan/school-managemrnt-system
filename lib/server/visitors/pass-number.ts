// Race-safe, school-scoped visitor-pass numbering (Phase 9I) — same atomic
// `UPDATE ... RETURNING` strategy as Phase 9F's receipt numbering and
// Phase 9G's journal-entry numbering. Format:
// VIS-<schoolCode>-<year>-<counter, zero-padded to 6>.
import { Prisma } from "@/lib/generated/prisma/client";

export async function nextVisitorPassNumber(tx: Prisma.TransactionClient, schoolId: string, schoolCode: string, year: number): Promise<string> {
  await tx.visitorPassCounter.upsert({ where: { schoolId }, create: { schoolId, counter: 0 }, update: {} });
  const rows = await tx.$queryRaw<{ counter: number }[]>`
    UPDATE visitor_pass_counters SET counter = counter + 1 WHERE "schoolId" = ${schoolId} RETURNING counter
  `;
  const counter = rows[0].counter;
  const safeCode = schoolCode.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || "SCH";
  return `VIS-${safeCode}-${year}-${String(counter).padStart(6, "0")}`;
}
