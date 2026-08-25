// Transport Documents — metadata-only compliance tracking. No file/
// attachment field anywhere: no file-storage infrastructure exists in this
// codebase, so this deliberately never claims to hold a document file, only
// its number/expiry for expiry-based compliance tracking.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { TransportComplianceSummaryDto, TransportDocumentDto, TransportDocumentEffectiveStatusDto, TransportDocumentSubjectTypeDto, TransportDocumentTypeDto } from "@/lib/api/contracts";
import { displayName, resolveTransportBranch } from "./access";

const TYPE_TO_DB: Record<TransportDocumentTypeDto, string> = {
  insurance: "INSURANCE", registration: "REGISTRATION", "fitness-certificate": "FITNESS_CERTIFICATE", permit: "PERMIT",
  "pollution-certificate": "POLLUTION_CERTIFICATE", "driving-license": "DRIVING_LICENSE", "police-verification": "POLICE_VERIFICATION", "medical-certificate": "MEDICAL_CERTIFICATE",
};
const VEHICLE_TYPES: TransportDocumentTypeDto[] = ["insurance", "registration", "fitness-certificate", "permit", "pollution-certificate"];
const STAFF_TYPES: TransportDocumentTypeDto[] = ["driving-license", "police-verification", "medical-certificate"];
const typeToUi = (t: string) => t.toLowerCase().replace(/_/g, "-") as TransportDocumentTypeDto;
const dateToUi = (d: Date) => d.toISOString().slice(0, 10);
const EXPIRING_SOON_DAYS = 30;

const select = {
  id: true, subjectType: true, vehicleId: true, staffId: true, type: true, documentNumber: true, expiryDate: true, notes: true, createdAt: true,
  vehicle: { select: { registrationNumber: true } },
  staff: { select: { firstName: true, lastName: true, displayName: true } },
} satisfies Prisma.TransportDocumentSelect;
type Row = Prisma.TransportDocumentGetPayload<{ select: typeof select }>;

function effectiveStatus(expiryDate: Date | null): TransportDocumentEffectiveStatusDto {
  if (!expiryDate) return "no-expiry";
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  const daysLeft = Math.floor((expiryDate.getTime() - today.getTime()) / 86_400_000);
  if (daysLeft < 0) return "expired";
  if (daysLeft <= EXPIRING_SOON_DAYS) return "expiring-soon";
  return "valid";
}

function dto(r: Row): TransportDocumentDto {
  return {
    id: r.id, subjectType: r.subjectType.toLowerCase() as TransportDocumentSubjectTypeDto, vehicleId: r.vehicleId, vehicleRegistration: r.vehicle?.registrationNumber ?? null,
    staffId: r.staffId, staffName: r.staff ? displayName(r.staff) : null, type: typeToUi(r.type), documentNumber: r.documentNumber,
    expiryDate: r.expiryDate ? dateToUi(r.expiryDate) : null, effectiveStatus: effectiveStatus(r.expiryDate), notes: r.notes, createdAt: r.createdAt.toISOString(),
  };
}

export async function listDocuments(scope: OrgScope, params: { subjectType?: string } = {}): Promise<TransportDocumentDto[]> {
  const where: Prisma.TransportDocumentWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.subjectType) where.subjectType = params.subjectType.toUpperCase() as never;
  const rows = await prisma.transportDocument.findMany({ where, orderBy: [{ expiryDate: "asc" }], select });
  return rows.map(dto);
}

export async function getComplianceSummary(scope: OrgScope): Promise<TransportComplianceSummaryDto> {
  const rows = await listDocuments(scope);
  const expiredCount = rows.filter((r) => r.effectiveStatus === "expired").length;
  const expiringSoonCount = rows.filter((r) => r.effectiveStatus === "expiring-soon").length;
  const blockedVehicleIds = new Set(rows.filter((r) => r.subjectType === "vehicle" && r.effectiveStatus === "expired" && r.vehicleId).map((r) => r.vehicleId));
  const blockedStaffIds = new Set(rows.filter((r) => r.subjectType === "staff" && r.effectiveStatus === "expired" && r.staffId).map((r) => r.staffId));
  return { expiredCount, expiringSoonCount, blockedVehicleCount: blockedVehicleIds.size, blockedDriverCount: blockedStaffIds.size };
}

export const addDocumentSchema = z.object({
  subjectType: z.enum(["vehicle", "staff"]),
  vehicleId: z.string().min(1).optional(),
  staffId: z.string().min(1).optional(),
  type: z.enum(["insurance", "registration", "fitness-certificate", "permit", "pollution-certificate", "driving-license", "police-verification", "medical-certificate"]),
  documentNumber: z.string().trim().max(100).optional(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export async function addDocument(scope: OrgScope, raw: unknown): Promise<TransportDocumentDto> {
  const input = parseInput(addDocumentSchema, raw);
  if (input.subjectType === "vehicle") {
    if (!input.vehicleId) throw new HttpError("VALIDATION_ERROR", "vehicleId is required for a vehicle document");
    if (!VEHICLE_TYPES.includes(input.type)) throw new HttpError("VALIDATION_ERROR", `${input.type} is not a vehicle document type`);
    const v = await prisma.transportVehicle.findFirst({ where: { id: input.vehicleId, schoolId: scope.schoolId }, select: { id: true } });
    if (!v) throw new HttpError("VALIDATION_ERROR", "Vehicle must be real and in this school");
  } else {
    if (!input.staffId) throw new HttpError("VALIDATION_ERROR", "staffId is required for a staff document");
    if (!STAFF_TYPES.includes(input.type)) throw new HttpError("VALIDATION_ERROR", `${input.type} is not a staff document type`);
    const s = await prisma.staff.findFirst({ where: { id: input.staffId, schoolId: scope.schoolId }, select: { id: true } });
    if (!s) throw new HttpError("VALIDATION_ERROR", "Staff member must be real and in this school");
  }

  const branchId = await resolveTransportBranch(scope);
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.transportDocument.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, subjectType: input.subjectType.toUpperCase() as never,
        vehicleId: input.subjectType === "vehicle" ? input.vehicleId! : null, staffId: input.subjectType === "staff" ? input.staffId! : null,
        type: TYPE_TO_DB[input.type] as never, documentNumber: input.documentNumber ?? null,
        expiryDate: input.expiryDate ? new Date(`${input.expiryDate}T00:00:00.000Z`) : null, notes: input.notes ?? null, createdByUserId: scope.actor.id,
      },
      select: { id: true },
    });
    await recordAudit(tx, scope, "TRANSPORT_DOCUMENT_ADDED", "TransportDocument", row.id, { subjectType: input.subjectType, type: input.type });
    return row.id;
  });
  const row = await prisma.transportDocument.findUniqueOrThrow({ where: { id: created }, select });
  return dto(row);
}
