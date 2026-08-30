// Production migration (Phase B, HR Sub-batch 2) — Staff Documents. Real
// Staff relationship, same precedent as Department/Designation/Contract —
// never a parallel employee model.
//
// STORAGE GAP (reported per task instructions, not invented around): no
// binary/object storage integration exists anywhere in this codebase (the
// only comparable model, Phase 9M's TransportDocument, is also metadata-
// only). This module is therefore metadata-only by design — externalReference
// is a free-text manual pointer (a filing location, an external link), never
// an actual uploaded file. The UI must disclose this plainly; it must never
// simulate a real upload.
//
// `visibility` gates self-service exposure: a document is only ever returned
// to the owning employee's own self-service view when visibility is
// explicitly STAFF_VISIBLE (default HR_ONLY — opt-in, not opt-out).
import { Prisma } from "@/lib/generated/prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import type { OrgScope } from "@/lib/server/api/scope";
import type { StaffDocumentDto, StaffDocumentStatusDto, StaffDocumentTypeDto, StaffDocumentVisibilityDto } from "@/lib/api/contracts";

const TYPE_TO_DTO: Record<string, StaffDocumentTypeDto> = {
  ID_PROOF: "id-proof",
  TAX_ID: "tax-id",
  QUALIFICATION: "qualification",
  EXPERIENCE_CERTIFICATE: "experience-certificate",
  APPOINTMENT_LETTER: "appointment-letter",
  CONTRACT: "contract",
  LICENSE: "license",
  BACKGROUND_CHECK: "background-check",
  MEDICAL_FITNESS: "medical-fitness",
  TRAINING_CERTIFICATE: "training-certificate",
  CUSTOM: "custom",
};
const DTO_TO_TYPE = Object.fromEntries(Object.entries(TYPE_TO_DTO).map(([k, v]) => [v, k])) as Record<StaffDocumentTypeDto, string>;
const DOCUMENT_TYPE_VALUES = Object.keys(DTO_TO_TYPE) as [StaffDocumentTypeDto, ...StaffDocumentTypeDto[]];

const STATUS_TO_DTO: Record<string, StaffDocumentStatusDto> = { UPLOADED: "uploaded", VERIFIED: "verified", REJECTED: "rejected", ARCHIVED: "archived" };
const VISIBILITY_TO_DTO: Record<string, StaffDocumentVisibilityDto> = { HR_ONLY: "hr-only", STAFF_VISIBLE: "staff-visible" };
const DTO_TO_VISIBILITY = Object.fromEntries(Object.entries(VISIBILITY_TO_DTO).map(([k, v]) => [v, k])) as Record<StaffDocumentVisibilityDto, string>;
const VISIBILITY_VALUES = Object.keys(DTO_TO_VISIBILITY) as [StaffDocumentVisibilityDto, ...StaffDocumentVisibilityDto[]];

type Row = {
  id: string;
  type: string;
  title: string;
  status: string;
  visibility: string;
  externalReference: string | null;
  expiryDate: Date | null;
  notes: string | null;
  uploadedByName: string | null;
  uploadedAt: Date;
  verifiedByName: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  staffId: string;
  staff: { employeeCode: string; firstName: string; lastName: string | null; displayName: string | null };
};

const select = {
  id: true, type: true, title: true, status: true, visibility: true, externalReference: true, expiryDate: true, notes: true,
  uploadedByName: true, uploadedAt: true, verifiedByName: true, verifiedAt: true, createdAt: true, updatedAt: true, staffId: true,
  staff: { select: { employeeCode: true, firstName: true, lastName: true, displayName: true } },
} satisfies Prisma.StaffDocumentSelect;

function staffName(s: { firstName: string; lastName: string | null; displayName: string | null }): string {
  return s.displayName?.trim() || `${s.firstName} ${s.lastName ?? ""}`.trim();
}

function toDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dto(row: Row, today: string): StaffDocumentDto {
  return {
    id: row.id,
    staffId: row.staffId,
    staffName: staffName(row.staff),
    employeeCode: row.staff.employeeCode,
    type: TYPE_TO_DTO[row.type] ?? "custom",
    title: row.title,
    status: (STATUS_TO_DTO[row.status] ?? "uploaded") as StaffDocumentStatusDto,
    visibility: (VISIBILITY_TO_DTO[row.visibility] ?? "hr-only") as StaffDocumentVisibilityDto,
    externalReference: row.externalReference,
    expiryDate: row.expiryDate ? toDate(row.expiryDate) : null,
    isExpired: row.expiryDate ? toDate(row.expiryDate) < today : false,
    notes: row.notes,
    uploadedByName: row.uploadedByName,
    uploadedAt: row.uploadedAt.toISOString(),
    verifiedByName: row.verifiedByName,
    verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function requireStaffRow(scope: OrgScope, staffId: string): Promise<{ id: string; branchId: string }> {
  const staff = await prisma.staff.findFirst({
    where: { id: staffId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    select: { id: true, branchId: true },
  });
  if (!staff) throw new HttpError("VALIDATION_ERROR", "Staff member not found in this school");
  return staff;
}

async function requireDocumentRow(scope: OrgScope, documentId: string): Promise<Row> {
  const row = await prisma.staffDocument.findFirst({
    where: { id: documentId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    select,
  });
  if (!row) throw new HttpError("STAFF_DOCUMENT_NOT_FOUND", "Document not found");
  return row;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function listStaffDocuments(scope: OrgScope, params: { staffId?: string; status?: StaffDocumentStatusDto } = {}): Promise<StaffDocumentDto[]> {
  const where: Prisma.StaffDocumentWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.staffId) where.staffId = params.staffId;
  if (params.status) where.status = params.status.toUpperCase() as never;
  const rows = await prisma.staffDocument.findMany({ where, select, orderBy: { uploadedAt: "desc" } });
  const t = today();
  return rows.map((r) => dto(r, t));
}

export async function getStaffDocument(scope: OrgScope, documentId: string): Promise<StaffDocumentDto> {
  return dto(await requireDocumentRow(scope, documentId), today());
}

/** Own-record reads (Employee Self Service) — ONLY documents explicitly marked
 * staff-visible are ever returned; HR-only documents never leak here. */
export async function listStaffDocumentsForStaff(scope: OrgScope, staffId: string): Promise<StaffDocumentDto[]> {
  const rows = await prisma.staffDocument.findMany({
    where: { schoolId: scope.schoolId, staffId, visibility: "STAFF_VISIBLE" },
    select,
    orderBy: { uploadedAt: "desc" },
  });
  const t = today();
  return rows.map((r) => dto(r, t));
}

export const uploadStaffDocumentSchema = z.object({
  staffId: z.string().min(1),
  type: z.enum(DOCUMENT_TYPE_VALUES),
  title: z.string().trim().min(1).max(160),
  visibility: z.enum(VISIBILITY_VALUES).optional(),
  externalReference: z.string().trim().max(500).optional(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export async function uploadStaffDocument(scope: OrgScope, raw: unknown): Promise<StaffDocumentDto> {
  const input = parseInput(uploadStaffDocumentSchema, raw);
  const staff = await requireStaffRow(scope, input.staffId);
  const row = await prisma.staffDocument.create({
    data: {
      tenantId: scope.tenantId,
      schoolId: scope.schoolId,
      branchId: staff.branchId,
      staffId: staff.id,
      type: DTO_TO_TYPE[input.type] as never,
      title: input.title,
      visibility: (input.visibility ? DTO_TO_VISIBILITY[input.visibility] : "HR_ONLY") as never,
      externalReference: input.externalReference,
      expiryDate: input.expiryDate ? new Date(`${input.expiryDate}T00:00:00Z`) : null,
      notes: input.notes,
      uploadedByUserId: scope.actor.id,
      uploadedByName: scope.actor.name,
    },
    select,
  });
  await recordAudit(prisma, scope, "STAFF_DOCUMENT_UPLOADED", "StaffDocument", row.id, { staffId: staff.id, type: input.type });
  return dto(row, today());
}

const STATUS_ACTION_TO_AUDIT = { verified: "STAFF_DOCUMENT_VERIFIED", rejected: "STAFF_DOCUMENT_REJECTED", archived: "STAFF_DOCUMENT_ARCHIVED" } as const;

/** Review workflow: verify/reject stamp the reviewer; archive is the delete-
 * equivalent (a document is a historical HR record, never hard-deleted). */
export async function setStaffDocumentStatus(
  scope: OrgScope,
  documentId: string,
  status: "verified" | "rejected" | "archived",
): Promise<StaffDocumentDto> {
  await requireDocumentRow(scope, documentId);
  const reviewFields =
    status === "verified" || status === "rejected"
      ? { verifiedByUserId: scope.actor.id, verifiedByName: scope.actor.name, verifiedAt: new Date() }
      : {};
  const row = await prisma.staffDocument.update({
    where: { id: documentId },
    data: { status: status.toUpperCase() as never, ...reviewFields },
    select,
  });
  await recordAudit(prisma, scope, STATUS_ACTION_TO_AUDIT[status], "StaffDocument", documentId, { status });
  return dto(row, today());
}
