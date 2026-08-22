// Asset Dashboard (Phase 9O) — DB-derived metrics only. `totalCost` is the
// plain sum of admin-entered acquisition prices (a real informational
// aggregate) — never a depreciated "book value", which this phase
// deliberately does not fabricate.
import { prisma } from "@/lib/db/prisma";
import type { OrgScope } from "@/lib/server/api/scope";
import type { AssetDashboardDto } from "@/lib/api/contracts";

export async function getAssetDashboard(scope: OrgScope): Promise<AssetDashboardDto> {
  const branchWhere = scope.branchId ? { branchId: scope.branchId } : {};
  const where = { schoolId: scope.schoolId, ...branchWhere };

  const [grouped, costAgg, maintenanceOpen, in60Days] = await Promise.all([
    prisma.asset.groupBy({ by: ["status"], where, _count: { _all: true } }),
    prisma.asset.aggregate({ where, _sum: { cost: true } }),
    prisma.assetMaintenanceRecord.findMany({
      where: { schoolId: scope.schoolId, ...branchWhere, status: { in: ["OPEN", "IN_PROGRESS"] } },
      select: { id: true, assetId: true, type: true, asset: { select: { name: true } } },
      take: 6, orderBy: { openedAt: "asc" },
    }),
    prisma.asset.findMany({
      where: { ...where, warrantyUntil: { gte: new Date(), lte: new Date(Date.now() + 60 * 86_400_000) } },
      select: { id: true, name: true, warrantyUntil: true, status: true },
      orderBy: { warrantyUntil: "asc" }, take: 6,
    }),
  ]);

  const byStatus = Object.fromEntries(grouped.map((g) => [g.status.toLowerCase(), g._count._all]));
  const total = grouped.reduce((s, g) => s + g._count._all, 0);

  return {
    total,
    available: byStatus.available ?? 0,
    assigned: byStatus.assigned ?? 0,
    maintenance: byStatus.maintenance ?? 0,
    lost: byStatus.lost ?? 0,
    damaged: byStatus.damaged ?? 0,
    retired: byStatus.retired ?? 0,
    totalCost: costAgg._sum.cost ? Number(costAgg._sum.cost) : 0,
    maintenanceOpen: maintenanceOpen.map((m) => ({ id: m.id, assetId: m.assetId, assetName: m.asset.name, type: m.type.toLowerCase() })),
    warrantyExpiringSoon: in60Days.map((a) => ({ id: a.id, name: a.name, warrantyUntil: a.warrantyUntil!.toISOString().slice(0, 10), status: a.status.toLowerCase() })),
  };
}
