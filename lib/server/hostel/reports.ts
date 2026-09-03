// Hostel Reports (Phase C1) — pure aggregator over real persisted state. No
// HostelReport model, no fabricated historical trend charts. Every metric is
// counted live from the tenant/school/branch-scoped tables it belongs to —
// never derived from a paginated page of results.
import { prisma } from "@/lib/db/prisma";
import type { OrgScope } from "@/lib/server/api/scope";
import type { HostelReportsDto } from "@/lib/api/contracts";

export async function getHostelReports(scope: OrgScope): Promise<HostelReportsDto> {
  const branchWhere = scope.branchId ? { branchId: scope.branchId } : {};
  const where = { schoolId: scope.schoolId, ...branchWhere };

  const [totalHostels, totalRooms, bedGroups, activeResidents, pendingLeaveRequests, activeVisitors, openComplaints, pendingMaintenance] = await Promise.all([
    prisma.hostel.count({ where: { ...where, status: "ACTIVE" } }),
    prisma.hostelRoom.count({ where }),
    prisma.hostelBed.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.studentHostelAssignment.count({ where: { ...where, status: "ACTIVE" } }),
    prisma.hostelLeaveRequest.count({ where: { ...where, status: "PENDING" } }),
    prisma.hostelVisitor.count({ where: { ...where, status: "CHECKED_IN" } }),
    prisma.hostelComplaint.count({ where: { ...where, status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] } } }),
    prisma.hostelMaintenanceRequest.count({ where: { ...where, status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] } } }),
  ]);

  const totalBeds = bedGroups.reduce((s, g) => s + g._count._all, 0);
  const activeBeds = bedGroups.find((g) => g.status === "ACTIVE")?._count._all ?? 0;

  return {
    totalHostels,
    totalRooms,
    totalBeds,
    occupiedBeds: activeResidents,
    availableBeds: Math.max(0, activeBeds - activeResidents),
    activeResidents,
    pendingLeaveRequests,
    activeVisitors,
    openComplaints,
    pendingMaintenance,
  };
}
