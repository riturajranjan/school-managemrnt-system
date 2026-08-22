// Health Profile (Phase 9R) — a thin factual record linked to exactly one
// real Student or Staff identity, never a second identity authority. Reading
// or writing a profile always requires health.viewSensitive/health.manage —
// there is no non-sensitive subset of a health profile worth exposing at
// plain health.view (unlike a Visit's "it happened" fact).
import { prisma } from "@/lib/db/prisma";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { HealthProfileDto } from "@/lib/api/contracts";
import { requireValidPatient } from "./access";

type Row = {
  id: string;
  bloodGroup: string | null;
  allergiesText: string | null;
  chronicConditionsText: string | null;
  careInstructions: string | null;
  physicianName: string | null;
  physicianPhone: string | null;
  insuranceProvider: string | null;
  insuranceNumberMasked: string | null;
  updatedAt: Date;
} | null;

function dto(row: Row, patient: { studentId: string | null; staffId: string | null }): HealthProfileDto {
  return {
    id: row?.id ?? null,
    patientType: patient.studentId ? "student" : "staff",
    patientId: (patient.studentId ?? patient.staffId)!,
    bloodGroup: row?.bloodGroup ?? null,
    allergiesText: row?.allergiesText ?? null,
    chronicConditionsText: row?.chronicConditionsText ?? null,
    careInstructions: row?.careInstructions ?? null,
    physicianName: row?.physicianName ?? null,
    physicianPhone: row?.physicianPhone ?? null,
    insuranceProvider: row?.insuranceProvider ?? null,
    insuranceNumberMasked: row?.insuranceNumberMasked ?? null,
    updatedAt: row?.updatedAt.toISOString() ?? null,
  };
}

const select = {
  id: true, bloodGroup: true, allergiesText: true, chronicConditionsText: true, careInstructions: true,
  physicianName: true, physicianPhone: true, insuranceProvider: true, insuranceNumberMasked: true, updatedAt: true,
} satisfies import("@/lib/generated/prisma/client").Prisma.HealthProfileSelect;

export async function getHealthProfileFor(scope: OrgScope, ref: { studentId?: string; staffId?: string }): Promise<HealthProfileDto> {
  const patient = await requireValidPatient(scope, ref);
  const row = await prisma.healthProfile.findFirst({
    where: patient.studentId ? { studentId: patient.studentId, schoolId: scope.schoolId } : { staffId: patient.staffId!, schoolId: scope.schoolId },
    select,
  });
  return dto(row, patient);
}

export const upsertHealthProfileSchema = z.object({
  bloodGroup: z.string().trim().max(10).nullable().optional(),
  allergiesText: z.string().trim().max(500).nullable().optional(),
  chronicConditionsText: z.string().trim().max(500).nullable().optional(),
  careInstructions: z.string().trim().max(500).nullable().optional(),
  physicianName: z.string().trim().max(120).nullable().optional(),
  physicianPhone: z.string().trim().max(30).nullable().optional(),
  insuranceProvider: z.string().trim().max(120).nullable().optional(),
  insuranceNumberMasked: z.string().trim().max(60).nullable().optional(),
});

export async function upsertHealthProfileFor(scope: OrgScope, ref: { studentId?: string; staffId?: string }, raw: unknown): Promise<HealthProfileDto> {
  const input = parseInput(upsertHealthProfileSchema, raw);
  const patient = await requireValidPatient(scope, ref);
  const data = {
    bloodGroup: input.bloodGroup, allergiesText: input.allergiesText, chronicConditionsText: input.chronicConditionsText,
    careInstructions: input.careInstructions, physicianName: input.physicianName, physicianPhone: input.physicianPhone,
    insuranceProvider: input.insuranceProvider, insuranceNumberMasked: input.insuranceNumberMasked,
    updatedByUserId: scope.actor.id,
  };
  const row = await prisma.healthProfile.upsert({
    where: patient.studentId ? { studentId: patient.studentId } : { staffId: patient.staffId! },
    create: {
      tenantId: scope.tenantId, schoolId: scope.schoolId,
      studentId: patient.studentId, staffId: patient.staffId,
      ...data,
    },
    update: data,
    select,
  });
  await recordAudit(prisma, scope, "HEALTH_PROFILE_UPDATED", "HealthProfile", row.id, { patientType: patient.studentId ? "student" : "staff" });
  return dto(row, patient);
}
