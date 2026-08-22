// DB-backed atomic document numbering (Phase 9V). Never Math.random(), never
// count()+1 — a single atomic upsert (INSERT ... ON CONFLICT DO UPDATE ...
// RETURNING, one Postgres statement) so concurrent generations for the same
// (school, docType, year) always allocate distinct sequence numbers.
import type { Prisma, PrismaClient } from "@/lib/generated/prisma/client";
import type { OrgScope } from "@/lib/server/api/scope";
import { DOC_TYPE_TO_DB } from "./templates";
import type { DocTypeDto } from "@/lib/api/contracts";

const PREFIX: Record<string, string> = {
  STUDENT_ID: "ID-STU",
  STAFF_ID: "ID-STF",
  BONAFIDE_CERTIFICATE: "BON",
  STUDY_CERTIFICATE: "STY",
  ACHIEVEMENT_CERTIFICATE: "ACH",
  EMPLOYMENT_CERTIFICATE: "EMP",
};

export async function allocateDocumentNumber(tx: Prisma.TransactionClient | PrismaClient, scope: OrgScope, docTypeDto: DocTypeDto): Promise<string> {
  const docType = DOC_TYPE_TO_DB[docTypeDto];
  const year = new Date().getFullYear();
  const counter = await tx.documentNumberCounter.upsert({
    where: { schoolId_docType_year: { schoolId: scope.schoolId, docType, year } },
    create: { tenantId: scope.tenantId, schoolId: scope.schoolId, docType, year, nextSeq: 2 },
    update: { nextSeq: { increment: 1 } },
    select: { nextSeq: true },
  });
  // On create, the row starts at nextSeq=2 and this generation used seq 1;
  // on update, `nextSeq` already reflects the post-increment value, so this
  // generation uses nextSeq-1 — an atomic read-your-own-allocation pattern.
  const seq = counter.nextSeq - 1;
  return `${PREFIX[docType]}-${scope.schoolId.slice(-4).toUpperCase()}-${year}-${String(seq).padStart(4, "0")}`;
}
