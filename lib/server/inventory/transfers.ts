// Inventory Transfers (Phase 9O). A transfer is a TRANSFER_OUT + TRANSFER_IN
// movement pair created atomically in one transaction, sharing a
// `referenceId` correlation id — there is no separate InventoryTransfer
// table; the paired movements ARE the transfer record. The postMovement()
// conditional decrement on TRANSFER_OUT makes "no half-transfer" real: if
// the source doesn't have enough stock, the whole transaction rolls back
// before TRANSFER_IN is ever created.
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { OrgScope } from "@/lib/server/api/scope";
import type { InventoryTransferDto } from "@/lib/api/contracts";
import { resolveInventoryBranch } from "./access";
import { requireLocationInScope, resolveOrCreateLocation } from "./locations";
import { postMovement } from "./ledger";

export const transferStockSchema = z
  .object({
    itemId: z.string().min(1),
    fromLocationId: z.string().min(1),
    toLocationId: z.string().min(1).optional(),
    toLocationName: z.string().trim().min(1).max(120).optional(),
    quantity: z.number().int().positive(),
    notes: z.string().trim().max(300).optional(),
  })
  .refine((v) => Boolean(v.toLocationId) !== Boolean(v.toLocationName), { message: "Provide exactly one of toLocationId or toLocationName" });

export async function transferStock(scope: OrgScope, raw: unknown): Promise<InventoryTransferDto> {
  const input = parseInput(transferStockSchema, raw);
  const branchId = await resolveInventoryBranch(scope);

  const item = await prisma.inventoryItem.findFirst({ where: { id: input.itemId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: { id: true, name: true } });
  if (!item) throw new HttpError("INVENTORY_ITEM_NOT_FOUND", "Item not found");
  const from = await requireLocationInScope(scope, input.fromLocationId);
  const to = input.toLocationId ? await requireLocationInScope(scope, input.toLocationId) : await resolveOrCreateLocation(scope, input.toLocationName!);
  if (from.id === to.id) throw new HttpError("INVALID_TRANSFER", "Source and destination must be different locations");

  const referenceId = randomUUID();
  const createdAt = await prisma.$transaction(async (tx) => {
    const out = await postMovement(tx, {
      tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, itemId: input.itemId, locationId: from.id,
      movementType: "TRANSFER_OUT", quantity: input.quantity, referenceType: "InventoryTransfer", referenceId, notes: input.notes,
      createdByUserId: scope.actor.id, createdByName: scope.actor.name ?? "System",
    });
    await postMovement(tx, {
      tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, itemId: input.itemId, locationId: to.id,
      movementType: "TRANSFER_IN", quantity: input.quantity, referenceType: "InventoryTransfer", referenceId, notes: input.notes,
      createdByUserId: scope.actor.id, createdByName: scope.actor.name ?? "System",
    });
    await recordAudit(tx, scope, "INVENTORY_STOCK_TRANSFERRED", "InventoryStockMovement", out.id, { itemId: input.itemId, quantity: input.quantity, fromLocationId: from.id, toLocationId: to.id });
    const row = await tx.inventoryStockMovement.findUniqueOrThrow({ where: { id: out.id }, select: { createdAt: true } });
    return row.createdAt;
  });

  const [fromLoc, toLoc] = await Promise.all([
    prisma.inventoryLocation.findUniqueOrThrow({ where: { id: from.id }, select: { name: true } }),
    prisma.inventoryLocation.findUniqueOrThrow({ where: { id: to.id }, select: { name: true } }),
  ]);
  return {
    id: referenceId, itemId: input.itemId, itemName: item.name, quantity: input.quantity,
    fromLocationId: from.id, fromLocationName: fromLoc.name, toLocationId: to.id, toLocationName: toLoc.name,
    createdAt: createdAt.toISOString(),
  };
}

export async function listTransfers(scope: OrgScope, params: { itemId?: string } = {}): Promise<InventoryTransferDto[]> {
  const where: Prisma.InventoryStockMovementWhereInput = {
    schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}),
    movementType: "TRANSFER_OUT", ...(params.itemId ? { itemId: params.itemId } : {}),
  };
  const outs = await prisma.inventoryStockMovement.findMany({
    where, orderBy: { createdAt: "desc" }, take: 200,
    select: { referenceId: true, itemId: true, quantity: true, locationId: true, createdAt: true, item: { select: { name: true } }, location: { select: { name: true } } },
  });
  const refIds = outs.map((o) => o.referenceId).filter((r): r is string => Boolean(r));
  const ins = await prisma.inventoryStockMovement.findMany({
    where: { movementType: "TRANSFER_IN", referenceId: { in: refIds } },
    select: { referenceId: true, locationId: true, location: { select: { name: true } } },
  });
  const inByRef = new Map(ins.map((i) => [i.referenceId, i]));
  return outs
    .filter((o) => o.referenceId && inByRef.has(o.referenceId))
    .map((o) => {
      const inRow = inByRef.get(o.referenceId!)!;
      return {
        id: o.referenceId!, itemId: o.itemId, itemName: o.item.name, quantity: o.quantity,
        fromLocationId: o.locationId, fromLocationName: o.location.name,
        toLocationId: inRow.locationId, toLocationName: inRow.location.name,
        createdAt: o.createdAt.toISOString(),
      };
    });
}
