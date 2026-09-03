// Health Medication Administration (Phase 9R) — a factual record of a
// medication given during a visit, never a prescription/dosage
// recommendation/refill schedule. medicationName is plain display text; there
// is no medication-order authority behind it, and it never decrements
// Inventory (Health and Inventory stay separate domains in this phase).
// Recording is only allowed while the visit is OPEN.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { HealthMedicationAdministrationDto, HealthMedicationListItemDto } from "@/lib/api/contracts";
import { resolveActingStaffId, staffDisplayName, studentDisplayName } from "./access";

export const recordMedicationSchema = z.object({
  medicationName: z.string().trim().min(1).max(200),
  quantity: z.string().trim().max(40).optional(),
  unit: z.string().trim().max(20).optional(),
  notes: z.string().trim().max(300).optional(),
});

export async function recordMedicationAdministration(scope: OrgScope, visitId: string, raw: unknown): Promise<HealthMedicationAdministrationDto> {
  const input = parseInput(recordMedicationSchema, raw);
  const visit = await prisma.healthVisit.findFirst({ where: { id: visitId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: { id: true, branchId: true, status: true } });
  if (!visit) throw new HttpError("HEALTH_VISIT_NOT_FOUND", "Visit not found");
  if (visit.status !== "OPEN") throw new HttpError("HEALTH_VISIT_ALREADY_CLOSED", "This visit is not open");

  const administeredByStaffId = await resolveActingStaffId(scope);
  const row = await prisma.healthMedicationAdministration.create({
    data: {
      tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: visit.branchId, visitId: visit.id,
      medicationName: input.medicationName, quantity: input.quantity, unit: input.unit, notes: input.notes,
      administeredByStaffId, createdByUserId: scope.actor.id,
    },
    include: { administeredBy: { select: { firstName: true, lastName: true, displayName: true } } },
  });
  await recordAudit(prisma, scope, "HEALTH_MEDICATION_RECORDED", "HealthMedicationAdministration", row.id, { visitId: visit.id });
  return {
    id: row.id, medicationName: row.medicationName, quantity: row.quantity, unit: row.unit, notes: row.notes,
    administeredByStaffId: row.administeredByStaffId,
    administeredByStaffName: row.administeredBy ? staffDisplayName(row.administeredBy) : null,
    administeredAt: row.administeredAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Cross-visit medication administration log (Phase C2). Read-only — there is
// no standalone "record a medication" action outside an open visit, and none
// is invented here. Content is inherently sensitive (drug name/dose), so the
// list/detail is entirely hidden (not field-redacted) from a caller who only
// holds health.view — mirrors getVisitDetail/getStudentHealthProfile's own
// medications-array gating exactly.
// ---------------------------------------------------------------------------

const listSelect = {
  id: true, medicationName: true, quantity: true, unit: true, notes: true, administeredAt: true,
  administeredByStaffId: true, visitId: true,
  administeredBy: { select: { firstName: true, lastName: true, displayName: true } },
  visit: {
    select: {
      status: true, studentId: true, staffId: true,
      student: { select: { firstName: true, lastName: true, admissionNumber: true } },
      staffPatient: { select: { firstName: true, lastName: true, displayName: true, employeeCode: true } },
    },
  },
} satisfies Prisma.HealthMedicationAdministrationSelect;

type ListRow = Prisma.HealthMedicationAdministrationGetPayload<{ select: typeof listSelect }>;

function listDto(m: ListRow): HealthMedicationListItemDto {
  const patientType = m.visit.studentId ? ("student" as const) : ("staff" as const);
  return {
    id: m.id, medicationName: m.medicationName, quantity: m.quantity, unit: m.unit, notes: m.notes,
    administeredByStaffId: m.administeredByStaffId,
    administeredByStaffName: m.administeredBy ? staffDisplayName(m.administeredBy) : null,
    administeredAt: m.administeredAt.toISOString(),
    visitId: m.visitId, visitStatus: m.visit.status.toLowerCase() as HealthMedicationListItemDto["visitStatus"],
    patientType, patientId: (m.visit.studentId ?? m.visit.staffId)!,
    patientName: m.visit.student ? studentDisplayName(m.visit.student) : staffDisplayName(m.visit.staffPatient!),
    patientRef: m.visit.student ? m.visit.student.admissionNumber : m.visit.staffPatient!.employeeCode,
  };
}

export const listMedicationsSchema = z.object({
  studentId: z.string().optional(),
  staffId: z.string().optional(),
  search: z.string().trim().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
});

export async function listMedicationAdministrations(
  scope: OrgScope,
  sensitive: boolean,
  raw: unknown,
): Promise<{ data: HealthMedicationListItemDto[]; meta: { page: number; pageSize: number; total: number; totalPages: number } }> {
  const input = parseInput(listMedicationsSchema, raw);
  if (!sensitive) return { data: [], meta: { page: input.page, pageSize: input.pageSize, total: 0, totalPages: 1 } };

  const where: Prisma.HealthMedicationAdministrationWhereInput = {
    schoolId: scope.schoolId,
    ...(scope.branchId ? { branchId: scope.branchId } : {}),
    ...(input.studentId ? { visit: { studentId: input.studentId } } : {}),
    ...(input.staffId ? { visit: { staffId: input.staffId } } : {}),
    ...(input.search?.trim() ? { medicationName: { contains: input.search.trim(), mode: "insensitive" } } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.healthMedicationAdministration.count({ where }),
    prisma.healthMedicationAdministration.findMany({ where, select: listSelect, orderBy: { administeredAt: "desc" }, skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
  ]);
  return { data: rows.map(listDto), meta: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.max(1, Math.ceil(total / input.pageSize)) } };
}

async function requireMedicationInScope(scope: OrgScope, id: string): Promise<ListRow> {
  const row = await prisma.healthMedicationAdministration.findFirst({ where: { id, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: listSelect });
  if (!row) throw new HttpError("HEALTH_MEDICATION_NOT_FOUND", "Medication record not found");
  return row;
}

export async function getMedicationAdministration(scope: OrgScope, id: string, sensitive: boolean): Promise<HealthMedicationListItemDto> {
  if (!sensitive) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  return listDto(await requireMedicationInScope(scope, id));
}
