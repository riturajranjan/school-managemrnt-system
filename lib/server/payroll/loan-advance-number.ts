// Race-safe, school+type-scoped numbering for Loans/Advances — the exact same
// atomic `UPDATE ... SET counter = counter + 1 RETURNING counter` strategy as
// entry-number.ts / purchase-order-number.ts. Format: LOAN-<year>-<counter,
// zero-padded to 4> / ADV-<year>-<counter, zero-padded to 4>.
import { Prisma } from "@/lib/generated/prisma/client";

const PREFIX: Record<"LOAN" | "ADVANCE", string> = { LOAN: "LOAN", ADVANCE: "ADV" };

export async function nextStaffFinancialAdvanceNumber(tx: Prisma.TransactionClient, schoolId: string, type: "LOAN" | "ADVANCE", year: number): Promise<string> {
  await tx.staffFinancialAdvanceCounter.upsert({ where: { schoolId_type: { schoolId, type } }, create: { schoolId, type, counter: 0 }, update: {} });
  const rows = await tx.$queryRaw<{ counter: number }[]>`
    UPDATE staff_financial_advance_counters SET counter = counter + 1 WHERE "schoolId" = ${schoolId} AND type = ${type}::"StaffFinancialAdvanceType" RETURNING counter
  `;
  return `${PREFIX[type]}-${year}-${String(rows[0].counter).padStart(4, "0")}`;
}
