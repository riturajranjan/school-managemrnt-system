// Hostel Dashboard (Phase 9Q) — DB-derived metrics only. No fabricated fee
// collection/meal satisfaction/parent approval/security score/complaint SLA.
import { prisma } from "@/lib/db/prisma";
import type { OrgScope } from "@/lib/server/api/scope";
import type { HostelDashboardDto } from "@/lib/api/contracts";

export async function getHostelDashboard(scope: OrgScope): Promise<HostelDashboardDto> {
  const branchWhere = scope.branchId ? { branchId: scope.branchId } : {};

  const [hostelCount, rooms, bedGroups, activeResidents, todayRollCall] = await Promise.all([
    prisma.hostel.count({ where: { schoolId: scope.schoolId, ...branchWhere, status: "ACTIVE" } }),
    prisma.hostelRoom.groupBy({ by: ["status"], where: { schoolId: scope.schoolId, ...branchWhere }, _count: { _all: true } }),
    prisma.hostelBed.groupBy({ by: ["status"], where: { schoolId: scope.schoolId, ...branchWhere }, _count: { _all: true } }),
    prisma.studentHostelAssignment.count({ where: { schoolId: scope.schoolId, ...branchWhere, status: "ACTIVE" } }),
    prisma.hostelRollCallRecord.groupBy({ by: ["status"], where: { schoolId: scope.schoolId, ...branchWhere, date: new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z") }, _count: { _all: true } }),
  ]);

  const roomsByStatus = Object.fromEntries(rooms.map((r) => [r.status.toLowerCase(), r._count._all]));
  const totalRooms = rooms.reduce((s, r) => s + r._count._all, 0);
  const activeBeds = bedGroups.find((g) => g.status === "ACTIVE")?._count._all ?? 0;
  const totalBeds = bedGroups.reduce((s, g) => s + g._count._all, 0);
  const rollCallByStatus = Object.fromEntries(todayRollCall.map((g) => [g.status.toLowerCase(), g._count._all]));
  const rollCallMarked = todayRollCall.reduce((s, g) => s + g._count._all, 0);

  return {
    totalHostels: hostelCount,
    totalRooms,
    roomsInMaintenance: roomsByStatus.maintenance ?? 0,
    totalBeds,
    activeBeds,
    occupiedBeds: activeResidents,
    availableBeds: Math.max(0, activeBeds - activeResidents),
    occupancyPct: activeBeds > 0 ? Math.round((activeResidents / activeBeds) * 100) : 0,
    activeResidents,
    presentTonight: rollCallByStatus.present ?? 0,
    onLeaveTonight: rollCallByStatus.on_leave ?? 0,
    notMarkedTonight: Math.max(0, activeResidents - rollCallMarked),
  };
}
