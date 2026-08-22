// Inventory Adjustments (Phase 9O) — explicit, reasoned corrections (e.g.
// stocktake reconciliation). A reason is mandatory: quantities never change
// without a movement record AND a stated reason (never a silent overwrite).
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { InventoryMovementDto } from "@/lib/api/contracts";
import { resolveInventoryBranch } from "./access";
import { requireLocationInScope, getOrCreateDefaultLocation } from "./locations";
import { postMovement } from "./ledger";

export const adjustStockSchema = z.object({
  itemId: z.string().min(1),
  locationId: z.string().min(1).optional(),
  quantity: z.number().int().refine((v) => v !== 0, "Quantity cannot be zero"),
  reason: z.string().trim().min(3).max(300),
});

export async function adjustStock(scope: OrgScope, raw: unknown): Promise<InventoryMovementDto> {
  const input = parseInput(adjustStockSchema, raw);
  const branchId = await resolveInventoryBranch(scope);
  const item = await prisma.inventoryItem.findFirst({ where: { id: input.itemId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: { id: true } });
  if (!item) throw new HttpError("INVENTORY_ITEM_NOT_FOUND", "Item not found");
  const location = input.locationId ? await requireLocationInScope(scope, input.locationId) : await getOrCreateDefaultLocation(scope);

  const movementId = await prisma.$transaction(async (tx) => {
    const m = await postMovement(tx, {
      tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, itemId: input.itemId, locationId: location.id,
      movementType: input.quantity > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT", quantity: Math.abs(input.quantity),
      notes: input.reason, createdByUserId: scope.actor.id, createdByName: scope.actor.name ?? "System",
    });
    await recordAudit(tx, scope, "INVENTORY_STOCK_ADJUSTED", "InventoryStockMovement", m.id, { itemId: input.itemId, quantity: input.quantity, reason: input.reason });
    return m.id;
  });

  const { listItemMovements } = await import("./movements");
  const movements = await listItemMovements(scope, input.itemId);
  return movements.find((m) => m.id === movementId)!;
}
