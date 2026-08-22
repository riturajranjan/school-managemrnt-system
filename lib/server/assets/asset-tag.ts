// Race-safe, school-scoped asset-tag numbering (Phase 9O) — same atomic
// `UPDATE ... RETURNING` strategy as Library's accession numbering / Visitor
// pass numbering. Format: AST-<counter, zero-padded to 6>.
import { Prisma } from "@/lib/generated/prisma/client";

export async function nextAssetTag(tx: Prisma.TransactionClient, schoolId: string): Promise<string> {
  await tx.assetTagCounter.upsert({ where: { schoolId }, create: { schoolId, counter: 0 }, update: {} });
  const rows = await tx.$queryRaw<{ counter: number }[]>`
    UPDATE asset_tag_counters SET counter = counter + 1 WHERE "schoolId" = ${schoolId} RETURNING counter
  `;
  const counter = rows[0].counter;
  return `AST-${String(counter).padStart(6, "0")}`;
}
