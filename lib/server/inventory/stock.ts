// Read-side stock aggregation (Phase 9O). Reads the InventoryStockBalance
// cache (see ledger.ts for the write-side invariant that keeps it correct) —
// never recomputed differently in two places, and never done client-side.
import { prisma } from "@/lib/db/prisma";
import type { OrgScope } from "@/lib/server/api/scope";

/** Total on-hand quantity per item, summed across every location in scope. */
export async function getItemStockMap(scope: OrgScope, itemIds?: string[]): Promise<Map<string, number>> {
  const grouped = await prisma.inventoryStockBalance.groupBy({
    by: ["itemId"],
    where: {
      ...(itemIds ? { itemId: { in: itemIds } } : {}),
      location: { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    },
    _sum: { quantity: true },
  });
  return new Map(grouped.map((g) => [g.itemId, g._sum.quantity ?? 0]));
}

export async function getItemTotalStock(scope: OrgScope, itemId: string): Promise<number> {
  const map = await getItemStockMap(scope, [itemId]);
  return map.get(itemId) ?? 0;
}

/** Per-(item, location) breakdown for one item (used on the item detail page). */
export async function getItemStockByLocation(scope: OrgScope, itemId: string): Promise<{ locationId: string; locationName: string; quantity: number }[]> {
  const rows = await prisma.inventoryStockBalance.findMany({
    where: { itemId, location: { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) } },
    select: { locationId: true, quantity: true, location: { select: { name: true } } },
  });
  return rows.filter((r) => r.quantity !== 0).map((r) => ({ locationId: r.locationId, locationName: r.location.name, quantity: r.quantity }));
}
