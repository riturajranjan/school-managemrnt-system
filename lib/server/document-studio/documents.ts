// Generated-document history & void (Phase 9V). Void is the only lifecycle
// transition — no invented SENT/SIGNED/APPROVED/DELIVERED. Voiding never
// deletes the row; the rendered snapshot stays fully readable.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { GeneratedDocumentDto, DocTypeDto } from "@/lib/api/contracts";
import { DOC_TYPE_TO_DB } from "./templates";
import { generatedDocumentDto, getGeneratedDocument } from "./generate";

const listSelect = {
  id: true, documentNumber: true, status: true, generatedByName: true, generatedAt: true, voidedAt: true, voidReason: true,
  studentId: true, staffId: true, templateVersion: true, renderedSnapshot: true,
  template: { select: { id: true, name: true, docType: true, kind: true, subjectType: true } },
} as const;

export async function listGeneratedDocuments(
  scope: OrgScope,
  params: { docType?: DocTypeDto; studentId?: string; staffId?: string; status?: string; q?: string } = {},
): Promise<GeneratedDocumentDto[]> {
  const where: Record<string, unknown> = { schoolId: scope.schoolId };
  if (params.docType) where.template = { docType: DOC_TYPE_TO_DB[params.docType] };
  if (params.studentId) where.studentId = params.studentId;
  if (params.staffId) where.staffId = params.staffId;
  if (params.status) where.status = params.status.toUpperCase();
  if (params.q?.trim()) where.documentNumber = { contains: params.q.trim(), mode: "insensitive" };
  const rows = await prisma.generatedDocument.findMany({ where, select: listSelect, orderBy: { generatedAt: "desc" }, take: 200 });
  return rows.map(generatedDocumentDto);
}

export { getGeneratedDocument };

export const voidSchema = z.object({ reason: z.string().trim().min(1).max(300) });

export async function voidDocument(scope: OrgScope, documentId: string, raw: unknown): Promise<GeneratedDocumentDto> {
  const input = parseInput(voidSchema, raw);
  const current = await prisma.generatedDocument.findFirst({ where: { id: documentId, schoolId: scope.schoolId }, select: { id: true, status: true } });
  if (!current) throw new HttpError("GENERATED_DOCUMENT_NOT_FOUND", "Document not found");
  if (current.status === "VOID") throw new HttpError("DOCUMENT_ALREADY_VOID", "This document is already void");

  await prisma.$transaction(async (tx) => {
    const updated = await tx.generatedDocument.updateMany({ where: { id: documentId, status: "GENERATED" }, data: { status: "VOID", voidedAt: new Date(), voidReason: input.reason } });
    if (updated.count === 0) throw new HttpError("DOCUMENT_ALREADY_VOID", "This document is already void");
    await recordAudit(tx, scope, "DOCUMENT_VOIDED", "GeneratedDocument", documentId, { reason: input.reason });
  });
  return getGeneratedDocument(scope, documentId);
}
