// Inventory Dashboard (Phase 9O) — DB-derived metrics only. No fabricated
// inventory value/procurement spend/supplier performance (no real cost or
// procurement model exists).
import { prisma } from "@/lib/db/prisma";
import type { OrgScope } from "@/lib/server/api/scope";
import type { InventoryDashboardDto } from "@/lib/api/contracts";
import { getItemStockMap } from "./stock";

export async function getInventoryDashboard(scope: OrgScope): Promise<InventoryDashboardDto> {
  const branchWhere = scope.branchId ? { branchId: scope.branchId } : {};
  const [items, locationCount, todayStart] = await Promise.all([
    prisma.inventoryItem.findMany({ where: { schoolId: scope.schoolId, ...branchWhere, status: "ACTIVE" }, select: { id: true, name: true, reorderLevel: true } }),
    prisma.inventoryLocation.count({ where: { schoolId: scope.schoolId, ...branchWhere, status: "ACTIVE" } }),
    Promise.resolve(new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z")),
  ]);

  const stockMap = await getItemStockMap(scope, items.map((i) => i.id));
  let totalUnits = 0, lowStock = 0, outOfStock = 0;
  const lowStockItems: { id: string; name: string; quantity: number; reorderLevel: number }[] = [];
  for (const item of items) {
    const qty = stockMap.get(item.id) ?? 0;
    totalUnits += qty;
    if (qty <= 0) outOfStock += 1;
    if (item.reorderLevel !== null && qty <= item.reorderLevel) {
      lowStock += 1;
      lowStockItems.push({ id: item.id, name: item.name, quantity: qty, reorderLevel: item.reorderLevel });
    }
  }
  lowStockItems.sort((a, b) => a.quantity - b.quantity);

  const movementsToday = await prisma.inventoryStockMovement.count({ where: { schoolId: scope.schoolId, ...branchWhere, createdAt: { gte: todayStart } } });

  return {
    totalItems: items.length, totalLocations: locationCount, totalUnitsOnHand: totalUnits,
    lowStockCount: lowStock, outOfStockCount: outOfStock, movementsToday,
    lowStockItems: lowStockItems.slice(0, 6),
  };
}
