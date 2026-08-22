// Health Medication Administration (Phase 9R) — a factual record of a
// medication given during a visit, never a prescription/dosage
// recommendation/refill schedule. medicationName is plain display text; there
// is no medication-order authority behind it, and it never decrements
// Inventory (Health and Inventory stay separate domains in this phase).
// Recording is only allowed while the visit is OPEN.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { HealthMedicationAdministrationDto } from "@/lib/api/contracts";
import { resolveActingStaffId, staffDisplayName } from "./access";

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
