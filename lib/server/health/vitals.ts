// Health Vitals (Phase 9R) — records measurements only. Never interprets or
// diagnoses (no hypertension labeling, no fever classification, no risk
// score). Validation rejects only physically-impossible values, never
// clinical judgement. Recording is only allowed while the visit is OPEN.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { HealthVitalObservationDto } from "@/lib/api/contracts";

async function requireOpenVisit(scope: OrgScope, visitId: string): Promise<{ id: string; branchId: string }> {
  const visit = await prisma.healthVisit.findFirst({ where: { id: visitId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: { id: true, status: true, branchId: true } });
  if (!visit) throw new HttpError("HEALTH_VISIT_NOT_FOUND", "Visit not found");
  if (visit.status !== "OPEN") throw new HttpError("HEALTH_VISIT_ALREADY_CLOSED", "This visit is not open");
  return visit;
}

// Sanity bounds only — physically-impossible values are rejected; nothing here
// interprets a value as feverish/hypertensive/abnormal.
export const recordVitalsSchema = z
  .object({
    temperatureC: z.number().min(20).max(45).optional(),
    pulseBpm: z.number().int().min(20).max(250).optional(),
    systolic: z.number().int().min(40).max(260).optional(),
    diastolic: z.number().int().min(20).max(150).optional(),
    oxygenSaturationPct: z.number().min(0).max(100).optional(),
    weightKg: z.number().min(0).max(300).optional(),
    heightCm: z.number().min(0).max(250).optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: "Record at least one measurement" });

export async function recordVitals(scope: OrgScope, visitId: string, raw: unknown): Promise<HealthVitalObservationDto> {
  const input = parseInput(recordVitalsSchema, raw);
  const visit = await requireOpenVisit(scope, visitId);

  const row = await prisma.healthVitalObservation.create({
    data: {
      tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: visit.branchId, visitId: visit.id,
      temperatureC: input.temperatureC, pulseBpm: input.pulseBpm, systolic: input.systolic, diastolic: input.diastolic,
      oxygenSaturationPct: input.oxygenSaturationPct, weightKg: input.weightKg, heightCm: input.heightCm,
      recordedByUserId: scope.actor.id,
    },
  });
  await recordAudit(prisma, scope, "HEALTH_VITAL_RECORDED", "HealthVitalObservation", row.id, { visitId: visit.id });
  return {
    id: row.id, temperatureC: row.temperatureC, pulseBpm: row.pulseBpm, systolic: row.systolic, diastolic: row.diastolic,
    oxygenSaturationPct: row.oxygenSaturationPct, weightKg: row.weightKg, heightCm: row.heightCm,
    recordedAt: row.recordedAt.toISOString(), recordedByUserId: row.recordedByUserId,
  };
}
