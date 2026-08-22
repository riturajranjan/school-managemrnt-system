// Health Dashboard (Phase 9R) — DB-derived counts only. No fabricated risk
// score, outbreak alert, vaccination compliance, or illness trend
// conclusion.
import { prisma } from "@/lib/db/prisma";
import type { OrgScope } from "@/lib/server/api/scope";
import type { HealthDashboardDto } from "@/lib/api/contracts";

export async function getHealthDashboard(scope: OrgScope): Promise<HealthDashboardDto> {
  const branchWhere = scope.branchId ? { branchId: scope.branchId } : {};
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 86_400_000);

  const [visitsToday, studentVisitsToday, staffVisitsToday, openVisits, referredToday, followUpsDue, medicationsRecordedToday] = await Promise.all([
    prisma.healthVisit.count({ where: { schoolId: scope.schoolId, ...branchWhere, checkedInAt: { gte: startOfToday, lt: endOfToday } } }),
    prisma.healthVisit.count({ where: { schoolId: scope.schoolId, ...branchWhere, checkedInAt: { gte: startOfToday, lt: endOfToday }, studentId: { not: null } } }),
    prisma.healthVisit.count({ where: { schoolId: scope.schoolId, ...branchWhere, checkedInAt: { gte: startOfToday, lt: endOfToday }, staffId: { not: null } } }),
    prisma.healthVisit.count({ where: { schoolId: scope.schoolId, ...branchWhere, status: "OPEN" } }),
    prisma.healthVisit.count({ where: { schoolId: scope.schoolId, ...branchWhere, status: "REFERRED", checkedOutAt: { gte: startOfToday, lt: endOfToday } } }),
    prisma.healthVisit.count({ where: { schoolId: scope.schoolId, ...branchWhere, followUpAt: { lte: endOfToday, not: null } } }),
    prisma.healthMedicationAdministration.count({ where: { schoolId: scope.schoolId, ...branchWhere, administeredAt: { gte: startOfToday, lt: endOfToday } } }),
  ]);

  return { visitsToday, studentVisitsToday, staffVisitsToday, openVisits, referredToday, followUpsDue, medicationsRecordedToday };
}
