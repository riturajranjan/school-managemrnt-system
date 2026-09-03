// Health Reports (Phase C2) — pure aggregator over real HealthVisit +
// HealthMedicationAdministration data only. No HealthReport model, no
// Incident/Appointment metric (neither is a modeled domain — see the Phase
// C2 audit), no fabricated trend/percentage/chart. `visitsByReason` contains
// sensitive free text (the same field visits.ts redacts elsewhere) and is
// only populated for a health.viewSensitive caller — every other field is a
// plain count, visible to health.view alone.
import { prisma } from "@/lib/db/prisma";
import type { OrgScope } from "@/lib/server/api/scope";
import type { HealthReportsDto } from "@/lib/api/contracts";

export async function getHealthReports(scope: OrgScope, sensitive: boolean): Promise<HealthReportsDto> {
  const where = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };

  const [statusGroups, medicationsRecorded, followUpsPending, reasonGroups] = await Promise.all([
    prisma.healthVisit.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.healthMedicationAdministration.count({ where }),
    prisma.healthVisit.count({ where: { ...where, followUpAt: { not: null } } }),
    sensitive
      ? prisma.healthVisit.groupBy({ by: ["reason"], where, _count: { _all: true }, orderBy: { _count: { reason: "desc" } }, take: 10 })
      : Promise.resolve([]),
  ]);

  const byStatus = Object.fromEntries(statusGroups.map((g) => [g.status, g._count._all]));
  const totalVisits = statusGroups.reduce((s, g) => s + g._count._all, 0);

  return {
    totalVisits,
    openVisits: byStatus.OPEN ?? 0,
    closedVisits: byStatus.CLOSED ?? 0,
    referredVisits: byStatus.REFERRED ?? 0,
    medicationsRecorded,
    followUpsPending,
    visitsByReason: reasonGroups.map((g) => ({ reason: g.reason, count: g._count._all })),
  };
}
