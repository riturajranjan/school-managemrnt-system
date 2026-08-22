// Infirmary Visits (Phase 9R). Patient is always exactly one real Student or
// Staff. Lifecycle is deliberately minimal — OPEN -> CLOSED or OPEN ->
// REFERRED, both terminal — administrative record-keeping, not a clinical
// state machine. Server timestamps are authoritative. Sensitive fields
// (reason/notes/careAction/referral text) are redacted to null unless the
// caller passes `sensitive: true` (health.viewSensitive), resolved once at
// the route layer from ctx.permissions — never re-derived here.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { HealthVisitDetailDto, HealthVisitDto } from "@/lib/api/contracts";
import { requireValidPatient, resolveActingStaffId, resolveHealthBranch, staffDisplayName, studentDisplayName } from "./access";

type Row = {
  id: string; studentId: string | null; staffId: string | null; status: string;
  reason: string; symptomsReported: string | null; observationNotes: string | null; careAction: string | null;
  guardianContacted: boolean; referralDestination: string | null; referralNotes: string | null; followUpAt: Date | null;
  attendedByStaffId: string | null; checkedInAt: Date; checkedOutAt: Date | null; createdAt: Date; updatedAt: Date;
  student: { firstName: string; lastName: string | null; admissionNumber: string } | null;
  staffPatient: { firstName: string; lastName: string | null; displayName: string | null; employeeCode: string } | null;
  attendedBy: { firstName: string; lastName: string | null; displayName: string | null } | null;
};

const select = {
  id: true, studentId: true, staffId: true, status: true, reason: true, symptomsReported: true, observationNotes: true,
  careAction: true, guardianContacted: true, referralDestination: true, referralNotes: true, followUpAt: true,
  attendedByStaffId: true, checkedInAt: true, checkedOutAt: true, createdAt: true, updatedAt: true,
  student: { select: { firstName: true, lastName: true, admissionNumber: true } },
  staffPatient: { select: { firstName: true, lastName: true, displayName: true, employeeCode: true } },
  attendedBy: { select: { firstName: true, lastName: true, displayName: true } },
} satisfies Prisma.HealthVisitSelect;

function dto(v: Row, sensitive: boolean): HealthVisitDto {
  const patientType = v.studentId ? "student" as const : "staff" as const;
  return {
    id: v.id, patientType, patientId: (v.studentId ?? v.staffId)!,
    patientName: v.student ? studentDisplayName(v.student) : staffDisplayName(v.staffPatient!),
    patientRef: v.student ? v.student.admissionNumber : v.staffPatient!.employeeCode,
    status: v.status.toLowerCase() as HealthVisitDto["status"],
    reason: sensitive ? v.reason : null,
    symptomsReported: sensitive ? v.symptomsReported : null,
    observationNotes: sensitive ? v.observationNotes : null,
    careAction: sensitive ? v.careAction : null,
    guardianContacted: v.guardianContacted,
    referralDestination: sensitive ? v.referralDestination : null,
    referralNotes: sensitive ? v.referralNotes : null,
    followUpAt: v.followUpAt?.toISOString() ?? null,
    attendedByStaffId: v.attendedByStaffId,
    attendedByStaffName: v.attendedBy ? staffDisplayName(v.attendedBy) : null,
    checkedInAt: v.checkedInAt.toISOString(), checkedOutAt: v.checkedOutAt?.toISOString() ?? null,
    createdAt: v.createdAt.toISOString(), updatedAt: v.updatedAt.toISOString(),
  };
}

export async function listVisits(
  scope: OrgScope,
  sensitive: boolean,
  params: { studentId?: string; staffId?: string; status?: string; page?: number; pageSize?: number } = {},
): Promise<{ items: HealthVisitDto[]; total: number }> {
  const where: Prisma.HealthVisitWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.studentId) where.studentId = params.studentId;
  if (params.staffId) where.staffId = params.staffId;
  if (params.status) where.status = params.status.toUpperCase() as never;
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const [rows, total] = await Promise.all([
    prisma.healthVisit.findMany({ where, select, orderBy: { checkedInAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.healthVisit.count({ where }),
  ]);
  return { items: rows.map((r) => dto(r, sensitive)), total };
}

async function requireVisitRow(scope: OrgScope, visitId: string): Promise<Row> {
  const row = await prisma.healthVisit.findFirst({ where: { id: visitId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select });
  if (!row) throw new HttpError("HEALTH_VISIT_NOT_FOUND", "Visit not found");
  return row;
}

export async function getVisit(scope: OrgScope, visitId: string, sensitive: boolean): Promise<HealthVisitDto> {
  return dto(await requireVisitRow(scope, visitId), sensitive);
}

export async function getVisitDetail(scope: OrgScope, visitId: string, sensitive: boolean): Promise<HealthVisitDetailDto> {
  const row = await requireVisitRow(scope, visitId);
  const base = dto(row, sensitive);
  if (!sensitive) return { ...base, vitals: [], treatments: [], medications: [] };

  const [vitals, treatments, medications] = await Promise.all([
    prisma.healthVitalObservation.findMany({ where: { visitId }, orderBy: { recordedAt: "desc" } }),
    prisma.healthTreatmentRecord.findMany({
      where: { visitId }, orderBy: { administeredAt: "desc" },
      include: { administeredBy: { select: { firstName: true, lastName: true, displayName: true } } },
    }),
    prisma.healthMedicationAdministration.findMany({
      where: { visitId }, orderBy: { administeredAt: "desc" },
      include: { administeredBy: { select: { firstName: true, lastName: true, displayName: true } } },
    }),
  ]);

  return {
    ...base,
    vitals: vitals.map((v) => ({
      id: v.id, temperatureC: v.temperatureC, pulseBpm: v.pulseBpm, systolic: v.systolic, diastolic: v.diastolic,
      oxygenSaturationPct: v.oxygenSaturationPct, weightKg: v.weightKg, heightCm: v.heightCm,
      recordedAt: v.recordedAt.toISOString(), recordedByUserId: v.recordedByUserId,
    })),
    treatments: treatments.map((t) => ({
      id: t.id, description: t.description, administeredByStaffId: t.administeredByStaffId,
      administeredByStaffName: t.administeredBy ? staffDisplayName(t.administeredBy) : null,
      administeredAt: t.administeredAt.toISOString(),
    })),
    medications: medications.map((m) => ({
      id: m.id, medicationName: m.medicationName, quantity: m.quantity, unit: m.unit, notes: m.notes,
      administeredByStaffId: m.administeredByStaffId,
      administeredByStaffName: m.administeredBy ? staffDisplayName(m.administeredBy) : null,
      administeredAt: m.administeredAt.toISOString(),
    })),
  };
}

export const createVisitSchema = z.object({
  studentId: z.string().min(1).optional(),
  staffId: z.string().min(1).optional(),
  reason: z.string().trim().min(1).max(300),
  symptomsReported: z.string().trim().max(1000).optional(),
  observationNotes: z.string().trim().max(1000).optional(),
  careAction: z.string().trim().max(300).optional(),
  guardianContacted: z.boolean().optional(),
});

export async function createVisit(scope: OrgScope, raw: unknown): Promise<HealthVisitDto> {
  const input = parseInput(createVisitSchema, raw);
  const patient = await requireValidPatient(scope, input);
  const branchId = scope.branchId ?? (await resolveHealthBranch(scope));
  const attendedByStaffId = await resolveActingStaffId(scope);

  const row = await prisma.healthVisit.create({
    data: {
      tenantId: scope.tenantId, schoolId: scope.schoolId, branchId,
      studentId: patient.studentId, staffId: patient.staffId,
      reason: input.reason, symptomsReported: input.symptomsReported, observationNotes: input.observationNotes,
      careAction: input.careAction, guardianContacted: input.guardianContacted ?? false,
      attendedByStaffId, createdByUserId: scope.actor.id,
    },
    select,
  });
  await recordAudit(prisma, scope, "HEALTH_VISIT_CREATED", "HealthVisit", row.id, { patientType: patient.studentId ? "student" : "staff" });
  return dto(row, true);
}

export const updateVisitSchema = z.object({
  reason: z.string().trim().min(1).max(300).optional(),
  symptomsReported: z.string().trim().max(1000).optional(),
  observationNotes: z.string().trim().max(1000).optional(),
  careAction: z.string().trim().max(300).optional(),
  guardianContacted: z.boolean().optional(),
  followUpAt: z.string().datetime().nullable().optional(),
});

export async function updateVisit(scope: OrgScope, visitId: string, raw: unknown): Promise<HealthVisitDto> {
  const input = parseInput(updateVisitSchema, raw);
  const current = await requireVisitRow(scope, visitId);
  if (current.status !== "OPEN") throw new HttpError("HEALTH_VISIT_ALREADY_CLOSED", "This visit is no longer open");
  const row = await prisma.healthVisit.update({
    where: { id: visitId },
    data: {
      reason: input.reason, symptomsReported: input.symptomsReported, observationNotes: input.observationNotes,
      careAction: input.careAction, guardianContacted: input.guardianContacted,
      followUpAt: input.followUpAt === undefined ? undefined : input.followUpAt === null ? null : new Date(input.followUpAt),
    },
    select,
  });
  await recordAudit(prisma, scope, "HEALTH_VISIT_UPDATED", "HealthVisit", visitId, {});
  return dto(row, true);
}

export async function closeVisit(scope: OrgScope, visitId: string): Promise<HealthVisitDto> {
  const current = await requireVisitRow(scope, visitId);
  if (current.status !== "OPEN") throw new HttpError("HEALTH_VISIT_ALREADY_CLOSED", "This visit is not open");
  await prisma.$transaction(async (tx) => {
    const updated = await tx.healthVisit.updateMany({ where: { id: visitId, status: "OPEN" }, data: { status: "CLOSED", checkedOutAt: new Date() } });
    if (updated.count === 0) throw new HttpError("HEALTH_VISIT_ALREADY_CLOSED", "This visit is not open");
    await recordAudit(tx, scope, "HEALTH_VISIT_CLOSED", "HealthVisit", visitId, {});
  });
  return getVisit(scope, visitId, true);
}

export const referVisitSchema = z.object({
  referralDestination: z.string().trim().max(200).optional(),
  referralNotes: z.string().trim().max(500).optional(),
  followUpAt: z.string().datetime().optional(),
});

export async function referVisit(scope: OrgScope, visitId: string, raw: unknown): Promise<HealthVisitDto> {
  const input = parseInput(referVisitSchema, raw);
  const current = await requireVisitRow(scope, visitId);
  if (current.status !== "OPEN") throw new HttpError("HEALTH_VISIT_ALREADY_CLOSED", "This visit is not open");
  await prisma.$transaction(async (tx) => {
    const updated = await tx.healthVisit.updateMany({
      where: { id: visitId, status: "OPEN" },
      data: {
        status: "REFERRED", checkedOutAt: new Date(),
        referralDestination: input.referralDestination, referralNotes: input.referralNotes,
        followUpAt: input.followUpAt ? new Date(input.followUpAt) : undefined,
      },
    });
    if (updated.count === 0) throw new HttpError("HEALTH_VISIT_ALREADY_CLOSED", "This visit is not open");
    await recordAudit(tx, scope, "HEALTH_VISIT_REFERRED", "HealthVisit", visitId, {});
  });
  return getVisit(scope, visitId, true);
}
