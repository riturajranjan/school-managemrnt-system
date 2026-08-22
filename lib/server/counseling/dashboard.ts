// Counseling Dashboard (Phase 9S) — DB-derived counts only. No fabricated
// risk score, wellbeing score, success rate, or severity distribution.
// "my*" fields are populated only when the caller resolves to a real,
// active counselor Staff record — never fabricated for a non-counselor viewer.
import { prisma } from "@/lib/db/prisma";
import type { OrgScope } from "@/lib/server/api/scope";
import type { CounselingDashboardDto } from "@/lib/api/contracts";
import { resolveActingStaffId } from "./access";

export async function getCounselingDashboard(scope: OrgScope): Promise<CounselingDashboardDto> {
  const branchWhere = scope.branchId ? { branchId: scope.branchId } : {};
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 86_400_000);
  const endOfTodayDate = new Date(now.toISOString().slice(0, 10) + "T00:00:00.000Z");

  const actingStaffId = await resolveActingStaffId(scope);

  const [totalOpenCases, totalActiveCases, unassignedCases, sessionsToday, followUpsDue, myOpenCases, myActiveCases, myFollowUpsDue] = await Promise.all([
    prisma.counselingCase.count({ where: { schoolId: scope.schoolId, ...branchWhere, status: "OPEN" } }),
    prisma.counselingCase.count({ where: { schoolId: scope.schoolId, ...branchWhere, status: "ACTIVE" } }),
    prisma.counselingCase.count({ where: { schoolId: scope.schoolId, ...branchWhere, assignedCounselorStaffId: null, status: { not: "CLOSED" } } }),
    prisma.counselingSession.count({ where: { schoolId: scope.schoolId, ...branchWhere, sessionDate: { gte: startOfToday, lt: endOfToday } } }),
    prisma.counselingCase.count({ where: { schoolId: scope.schoolId, ...branchWhere, status: { not: "CLOSED" }, followUpDate: { lte: endOfTodayDate, not: null } } }),
    actingStaffId ? prisma.counselingCase.count({ where: { schoolId: scope.schoolId, ...branchWhere, assignedCounselorStaffId: actingStaffId, status: "OPEN" } }) : Promise.resolve(0),
    actingStaffId ? prisma.counselingCase.count({ where: { schoolId: scope.schoolId, ...branchWhere, assignedCounselorStaffId: actingStaffId, status: "ACTIVE" } }) : Promise.resolve(0),
    actingStaffId
      ? prisma.counselingCase.count({ where: { schoolId: scope.schoolId, ...branchWhere, assignedCounselorStaffId: actingStaffId, status: { not: "CLOSED" }, followUpDate: { lte: endOfTodayDate, not: null } } })
      : Promise.resolve(0),
  ]);

  return { totalOpenCases, totalActiveCases, unassignedCases, sessionsToday, followUpsDue, myOpenCases, myActiveCases, myFollowUpsDue };
}
