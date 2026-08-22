// Document generation (Phase 9V) — server-authoritative. Preview resolves
// merge fields and renders WITHOUT allocating a document number or persisting
// anything (never confused with an issued document). Generate does the full
// flow in one transaction: verify ACTIVE template -> validate subject ->
// resolve allowlisted merge fields -> snapshot -> allocate number -> persist
// -> audit.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { GeneratedDocumentDto, PreviewDocumentResponse } from "@/lib/api/contracts";
import { requireValidStaff, requireValidStudent, staffDisplayName, studentDisplayName } from "./access";
import { resolveMergeFields } from "./merge-fields";
import { buildDocumentSheetData, buildIdCardRecord, isIdCard } from "./render";
import { allocateDocumentNumber } from "./numbering";
import { requireActiveTemplate, templateDto, type TemplateRow } from "./templates";

export const generateSchema = z.object({
  templateId: z.string().min(1),
  studentId: z.string().min(1).optional(),
  staffId: z.string().min(1).optional(),
  achievementId: z.string().min(1).optional(),
  purpose: z.string().trim().max(200).optional(),
});

async function resolveSubject(scope: OrgScope, template: TemplateRow, input: z.infer<typeof generateSchema>) {
  if (template.subjectType === "STUDENT") {
    if (!input.studentId) throw new HttpError("INVALID_DOCUMENT_SUBJECT", "A student is required for this template");
    const student = await requireValidStudent(scope, input.studentId);
    const full = await prisma.student.findUniqueOrThrow({ where: { id: student.id }, select: { firstName: true, lastName: true } });
    return { subjectType: "STUDENT" as const, studentId: student.id, staffId: undefined, branchId: student.branchId, recipientName: studentDisplayName(full) };
  }
  if (!input.staffId) throw new HttpError("INVALID_DOCUMENT_SUBJECT", "A staff member is required for this template");
  const staff = await requireValidStaff(scope, input.staffId);
  const full = await prisma.staff.findUniqueOrThrow({ where: { id: staff.id }, select: { firstName: true, lastName: true, displayName: true } });
  return { subjectType: "STAFF" as const, studentId: undefined, staffId: staff.id, branchId: staff.branchId, recipientName: staffDisplayName(full) };
}

async function renderFor(scope: OrgScope, template: TemplateRow, input: z.infer<typeof generateSchema>, documentNumber: string | undefined) {
  const templateDtoValue = templateDto(template);
  const subject = await resolveSubject(scope, template, input);

  if (input.achievementId && subject.studentId) {
    const owns = await prisma.studentAchievement.findFirst({ where: { id: input.achievementId, studentId: subject.studentId, schoolId: scope.schoolId }, select: { id: true } });
    if (!owns) throw new HttpError("INVALID_DOCUMENT_SUBJECT", "Achievement does not belong to this student");
  }
  if (templateDtoValue.docType === "achievement-certificate" && !input.achievementId) {
    throw new HttpError("INVALID_DOCUMENT_SUBJECT", "An achievement must be selected for this template");
  }

  const { resolved, unresolved } = await resolveMergeFields(
    { scope, subjectType: subject.subjectType, studentId: subject.studentId, staffId: subject.staffId, achievementId: input.achievementId },
    templateDtoValue.variables,
  );

  const recipientSubtitle = resolved["student.class"] ?? resolved["staff.designation"];

  if (isIdCard(templateDtoValue.docType)) {
    const sessionEnd = scope.academicSessionId ? (await prisma.academicSession.findUnique({ where: { id: scope.academicSessionId }, select: { endDate: true } }))?.endDate : undefined;
    const rendered = buildIdCardRecord({
      id: documentNumber ?? "preview", cardNumber: documentNumber, subjectType: subject.subjectType === "STUDENT" ? "student" : "staff",
      holderName: subject.recipientName, subtitle: recipientSubtitle ?? "", style: templateDtoValue.style,
      expiryDate: (sessionEnd ?? new Date(new Date().getFullYear() + 1, 2, 31)).toISOString().slice(0, 10),
      issueDate: new Date().toISOString().slice(0, 10), status: "issued", resolved,
    });
    return { rendered, unresolved, subject, resolved, recipientSubtitle };
  }
  const rendered = buildDocumentSheetData({
    template: templateDtoValue, documentNumber, recipientName: subject.recipientName, recipientSubtitle,
    resolved, purpose: input.purpose, issuedDate: new Date().toISOString().slice(0, 10), token: documentNumber,
  });
  return { rendered, unresolved, subject, resolved, recipientSubtitle };
}

export async function previewDocument(scope: OrgScope, raw: unknown): Promise<PreviewDocumentResponse> {
  const input = parseInput(generateSchema, raw);
  const template = await requireActiveTemplate(scope, input.templateId);
  const { rendered, unresolved } = await renderFor(scope, template, input, undefined);
  return { rendered, unresolved };
}

function toDto(row: {
  id: string; documentNumber: string; status: string; generatedByName: string; generatedAt: Date; voidedAt: Date | null; voidReason: string | null;
  studentId: string | null; staffId: string | null; templateVersion: number; renderedSnapshot: unknown;
  template: { id: string; name: string; docType: string; kind: string; subjectType: string };
}): GeneratedDocumentDto {
  const rendered = row.renderedSnapshot as GeneratedDocumentDto["rendered"];
  return {
    id: row.id, documentNumber: row.documentNumber,
    docType: row.template.docType.toLowerCase().replace(/_/g, "-") as GeneratedDocumentDto["docType"],
    kind: row.template.kind.toLowerCase().replace(/_/g, "-") as GeneratedDocumentDto["kind"],
    subjectType: row.template.subjectType.toLowerCase() as GeneratedDocumentDto["subjectType"],
    templateId: row.template.id, templateName: row.template.name, templateVersion: row.templateVersion,
    studentId: row.studentId, staffId: row.staffId,
    recipientName: "fields" in rendered ? rendered.recipientName : rendered.holderName,
    recipientSubtitle: ("fields" in rendered ? rendered.recipientSubtitle : rendered.subtitle) ?? null,
    status: row.status.toLowerCase() as GeneratedDocumentDto["status"],
    generatedByName: row.generatedByName, generatedAt: row.generatedAt.toISOString(),
    voidedAt: row.voidedAt?.toISOString() ?? null, voidReason: row.voidReason,
    rendered,
  };
}

export async function generateDocument(scope: OrgScope, raw: unknown): Promise<GeneratedDocumentDto> {
  const input = parseInput(generateSchema, raw);
  const template = await requireActiveTemplate(scope, input.templateId);
  const templateDtoValue = templateDto(template);

  const id = await prisma.$transaction(async (tx) => {
    const documentNumber = await allocateDocumentNumber(tx, scope, templateDtoValue.docType);
    const { rendered, unresolved, subject, resolved } = await renderFor(scope, template, input, documentNumber);
    if (unresolved.length > 0) throw new HttpError("INVALID_DOCUMENT_SUBJECT", `Could not resolve required field(s): ${unresolved.join(", ")}`);

    const row = await tx.generatedDocument.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: subject.branchId, academicSessionId: scope.academicSessionId,
        templateId: template.id, templateVersion: template.version, subjectType: subject.subjectType,
        studentId: subject.studentId, staffId: subject.staffId, documentNumber,
        sourceSnapshotJson: resolved, renderedSnapshot: rendered as object,
        generatedByUserId: scope.actor.id, generatedByName: scope.actor.name ?? "Unknown",
      },
      select: { id: true },
    });
    await recordAudit(tx, scope, "DOCUMENT_GENERATED", "GeneratedDocument", row.id, { templateId: template.id, documentNumber });
    return row.id;
  });

  return getGeneratedDocument(scope, id);
}

export async function getGeneratedDocument(scope: OrgScope, documentId: string): Promise<GeneratedDocumentDto> {
  const row = await prisma.generatedDocument.findFirst({
    where: { id: documentId, schoolId: scope.schoolId },
    select: {
      id: true, documentNumber: true, status: true, generatedByName: true, generatedAt: true, voidedAt: true, voidReason: true,
      studentId: true, staffId: true, templateVersion: true, renderedSnapshot: true,
      template: { select: { id: true, name: true, docType: true, kind: true, subjectType: true } },
    },
  });
  if (!row) throw new HttpError("GENERATED_DOCUMENT_NOT_FOUND", "Document not found");
  return toDto(row);
}

export { toDto as generatedDocumentDto };
