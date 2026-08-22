// Health Treatment Records (Phase 9R) — factual first-aid/care given during a
// visit, never a prescription. Recording is only allowed while the visit is
// OPEN.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { HealthTreatmentRecordDto } from "@/lib/api/contracts";
import { resolveActingStaffId, staffDisplayName } from "./access";

export const recordTreatmentSchema = z.object({ description: z.string().trim().min(1).max(500) });

export async function recordTreatment(scope: OrgScope, visitId: string, raw: unknown): Promise<HealthTreatmentRecordDto> {
  const input = parseInput(recordTreatmentSchema, raw);
  const visit = await prisma.healthVisit.findFirst({ where: { id: visitId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: { id: true, branchId: true, status: true } });
  if (!visit) throw new HttpError("HEALTH_VISIT_NOT_FOUND", "Visit not found");
  if (visit.status !== "OPEN") throw new HttpError("HEALTH_VISIT_ALREADY_CLOSED", "This visit is not open");

  const administeredByStaffId = await resolveActingStaffId(scope);
  const row = await prisma.healthTreatmentRecord.create({
    data: {
      tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: visit.branchId, visitId: visit.id,
      description: input.description, administeredByStaffId, createdByUserId: scope.actor.id,
    },
    include: { administeredBy: { select: { firstName: true, lastName: true, displayName: true } } },
  });
  await recordAudit(prisma, scope, "HEALTH_TREATMENT_RECORDED", "HealthTreatmentRecord", row.id, { visitId: visit.id });
  return {
    id: row.id, description: row.description, administeredByStaffId: row.administeredByStaffId,
    administeredByStaffName: row.administeredBy ? staffDisplayName(row.administeredBy) : null,
    administeredAt: row.administeredAt.toISOString(),
  };
}
