// Document templates (Phase 9V). DRAFT is freely editable; editing an ACTIVE
// template's content increments `version` (old GeneratedDocument rows keep
// the version — and full snapshot — they were produced with); ARCHIVED can no
// longer generate but its history remains fully readable. Templates are never
// deleted (a generated document may reference one forever).
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { DocumentTemplateDto, DocTypeDto } from "@/lib/api/contracts";
import { resolveDocumentBranch } from "./access";
import { contentJsonSchema, validateTemplateContent, type ContentJson } from "./content";
import { DOC_TYPE_TAXONOMY, type DocTypeKey } from "./taxonomy";

const DOC_TYPE_TO_DB: Record<DocTypeDto, DocTypeKey> = {
  "student-id": "STUDENT_ID",
  "staff-id": "STAFF_ID",
  "bonafide-certificate": "BONAFIDE_CERTIFICATE",
  "study-certificate": "STUDY_CERTIFICATE",
  "achievement-certificate": "ACHIEVEMENT_CERTIFICATE",
  "employment-certificate": "EMPLOYMENT_CERTIFICATE",
};
const DOC_TYPE_FROM_DB: Record<string, DocTypeDto> = Object.fromEntries(Object.entries(DOC_TYPE_TO_DB).map(([k, v]) => [v, k as DocTypeDto]));
const KIND_FROM_DB: Record<string, DocumentTemplateDto["kind"]> = { ID_CARD: "id-card", STUDENT_CERTIFICATE: "student-certificate", STAFF_CERTIFICATE: "staff-certificate" };
const SUBJECT_FROM_DB: Record<string, DocumentTemplateDto["subjectType"]> = { STUDENT: "student", STAFF: "staff" };
const STATUS_FROM_DB: Record<string, DocumentTemplateDto["status"]> = { DRAFT: "draft", ACTIVE: "active", ARCHIVED: "archived" };

type Row = {
  id: string; code: string; name: string; description: string | null;
  kind: string; docType: string; subjectType: string; status: string; version: number; contentJson: Prisma.JsonValue;
  createdAt: Date; updatedAt: Date;
  _count: { generatedDocuments: number };
};

const select = {
  id: true, code: true, name: true, description: true, kind: true, docType: true, subjectType: true, status: true, version: true, contentJson: true,
  createdAt: true, updatedAt: true,
  _count: { select: { generatedDocuments: true } },
} satisfies Prisma.DocumentTemplateSelect;

function dto(t: Row): DocumentTemplateDto {
  const content = t.contentJson as unknown as ContentJson;
  return {
    id: t.id, code: t.code, name: t.name, description: t.description,
    kind: KIND_FROM_DB[t.kind], docType: DOC_TYPE_FROM_DB[t.docType], subjectType: SUBJECT_FROM_DB[t.subjectType],
    status: STATUS_FROM_DB[t.status], version: t.version,
    paperSize: content.paperSize, orientation: content.orientation, accent: content.accent, style: content.style,
    sections: content.sections, variables: content.variables, signatoryName: content.signatoryName,
    usageCount: t._count.generatedDocuments, isDefault: false, thumbnailTone: "info",
    createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString(),
  };
}

export async function listTemplates(scope: OrgScope, params: { docType?: DocTypeDto; status?: string; kind?: string } = {}): Promise<DocumentTemplateDto[]> {
  const where: Prisma.DocumentTemplateWhereInput = { schoolId: scope.schoolId };
  if (params.docType) where.docType = DOC_TYPE_TO_DB[params.docType];
  if (params.status) where.status = params.status.toUpperCase() as never;
  if (params.kind) where.kind = params.kind.toUpperCase().replace(/-/g, "_") as never;
  const rows = await prisma.documentTemplate.findMany({ where, select, orderBy: { updatedAt: "desc" } });
  return rows.map(dto);
}

async function requireTemplateRow(scope: OrgScope, templateId: string): Promise<Row> {
  const row = await prisma.documentTemplate.findFirst({ where: { id: templateId, schoolId: scope.schoolId }, select });
  if (!row) throw new HttpError("DOCUMENT_TEMPLATE_NOT_FOUND", "Template not found");
  return row;
}

export async function getTemplate(scope: OrgScope, templateId: string): Promise<DocumentTemplateDto> {
  return dto(await requireTemplateRow(scope, templateId));
}

export async function requireActiveTemplate(scope: OrgScope, templateId: string): Promise<Row> {
  const row = await requireTemplateRow(scope, templateId);
  if (row.status !== "ACTIVE") throw new HttpError("DOCUMENT_TEMPLATE_NOT_ACTIVE", "This template is not active");
  return row;
}

const contentFields = {
  paperSize: contentJsonSchema.shape.paperSize,
  orientation: contentJsonSchema.shape.orientation,
  accent: contentJsonSchema.shape.accent,
  style: contentJsonSchema.shape.style,
  sections: contentJsonSchema.shape.sections,
  variables: contentJsonSchema.shape.variables,
  signatoryName: contentJsonSchema.shape.signatoryName,
};

export const createTemplateSchema = z.object({
  code: z.string().trim().min(1).max(24),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  docType: z.enum(["student-id", "staff-id", "bonafide-certificate", "study-certificate", "achievement-certificate", "employment-certificate"]),
  ...contentFields,
});

export async function createTemplate(scope: OrgScope, raw: unknown): Promise<DocumentTemplateDto> {
  const input = parseInput(createTemplateSchema, raw);
  const taxonomy = DOC_TYPE_TAXONOMY[DOC_TYPE_TO_DB[input.docType]];
  const content = validateTemplateContent(taxonomy.subjectType, {
    paperSize: input.paperSize, orientation: input.orientation, accent: input.accent, style: input.style,
    sections: input.sections, variables: input.variables, signatoryName: input.signatoryName,
  });
  const branchId = await resolveDocumentBranch(scope);

  let row;
  try {
    row = await prisma.documentTemplate.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, code: input.code, name: input.name, description: input.description,
        kind: taxonomy.kind, docType: DOC_TYPE_TO_DB[input.docType], subjectType: taxonomy.subjectType,
        contentJson: content as unknown as Prisma.InputJsonValue,
        createdByUserId: scope.actor.id, updatedByUserId: scope.actor.id,
      },
      select,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError("DOCUMENT_TEMPLATE_CODE_EXISTS", "A template with this code already exists");
    throw e;
  }
  await recordAudit(prisma, scope, "DOCUMENT_TEMPLATE_CREATED", "DocumentTemplate", row.id, { code: row.code, docType: input.docType });
  return dto(row);
}

export const updateTemplateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  ...Object.fromEntries(Object.entries(contentFields).map(([k, v]) => [k, v.optional()])),
});

export async function updateTemplate(scope: OrgScope, templateId: string, raw: unknown): Promise<DocumentTemplateDto> {
  const input = parseInput(updateTemplateSchema, raw);
  const current = await requireTemplateRow(scope, templateId);
  if (current.status === "ARCHIVED") throw new HttpError("DOCUMENT_TEMPLATE_NOT_ACTIVE", "An archived template cannot be edited");
  const currentContent = current.contentJson as unknown as ContentJson;

  const contentTouched = ["paperSize", "orientation", "accent", "style", "sections", "variables", "signatoryName"].some((k) => k in (raw as object));
  const nextContentRaw = { ...currentContent, ...Object.fromEntries(Object.keys(contentFields).map((k) => [k, (input as Record<string, unknown>)[k] ?? (currentContent as Record<string, unknown>)[k]])) };
  const nextContent = contentTouched ? validateTemplateContent(SUBJECT_FROM_DB[current.subjectType] === "student" ? "STUDENT" : "STAFF", nextContentRaw) : currentContent;

  const row = await prisma.documentTemplate.update({
    where: { id: templateId },
    data: {
      name: input.name, description: input.description,
      contentJson: nextContent as unknown as Prisma.InputJsonValue,
      version: contentTouched && current.status === "ACTIVE" ? { increment: 1 } : undefined,
      updatedByUserId: scope.actor.id,
    },
    select,
  });
  await recordAudit(prisma, scope, "DOCUMENT_TEMPLATE_UPDATED", "DocumentTemplate", templateId, { contentTouched });
  return dto(row);
}

export async function activateTemplate(scope: OrgScope, templateId: string): Promise<DocumentTemplateDto> {
  const current = await requireTemplateRow(scope, templateId);
  if (current.status === "ARCHIVED") throw new HttpError("DOCUMENT_TEMPLATE_NOT_ACTIVE", "An archived template cannot be reactivated");
  validateTemplateContent(SUBJECT_FROM_DB[current.subjectType] === "student" ? "STUDENT" : "STAFF", current.contentJson);
  const row = await prisma.documentTemplate.update({ where: { id: templateId }, data: { status: "ACTIVE", updatedByUserId: scope.actor.id }, select });
  await recordAudit(prisma, scope, "DOCUMENT_TEMPLATE_ACTIVATED", "DocumentTemplate", templateId, {});
  return dto(row);
}

export async function archiveTemplate(scope: OrgScope, templateId: string): Promise<DocumentTemplateDto> {
  await requireTemplateRow(scope, templateId);
  const row = await prisma.documentTemplate.update({ where: { id: templateId }, data: { status: "ARCHIVED", updatedByUserId: scope.actor.id }, select });
  await recordAudit(prisma, scope, "DOCUMENT_TEMPLATE_ARCHIVED", "DocumentTemplate", templateId, {});
  return dto(row);
}

export { DOC_TYPE_TO_DB, DOC_TYPE_FROM_DB, KIND_FROM_DB, SUBJECT_FROM_DB, STATUS_FROM_DB, select as templateSelect, dto as templateDto };
export type { Row as TemplateRow };
