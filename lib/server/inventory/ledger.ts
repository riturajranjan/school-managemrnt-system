// Inventory stock ledger core (Phase 9O). InventoryStockMovement is the
// append-only authority; InventoryStockBalance is a transactionally-
// maintained cache used ONLY to make negative-stock prevention race-safe
// without raw SQL row-locking (see the model's doc comment in schema.prisma).
// Every movement insert and its matching balance update happen inside the
// SAME transaction, so the two can never drift.
import { Prisma } from "@/lib/generated/prisma/client";
import { HttpError } from "@/lib/server/api/guard";

export const INBOUND_MOVEMENT_TYPES = ["OPENING", "RECEIPT", "TRANSFER_IN", "ADJUSTMENT_IN", "RETURN"] as const;
export const OUTBOUND_MOVEMENT_TYPES = ["ISSUE", "TRANSFER_OUT", "ADJUSTMENT_OUT"] as const;
export type InventoryMovementTypeValue = (typeof INBOUND_MOVEMENT_TYPES)[number] | (typeof OUTBOUND_MOVEMENT_TYPES)[number];

function isInbound(type: InventoryMovementTypeValue): boolean {
  return (INBOUND_MOVEMENT_TYPES as readonly string[]).includes(type);
}

type MovementInput = {
  tenantId: string;
  schoolId: string;
  branchId: string;
  itemId: string;
  locationId: string;
  movementType: InventoryMovementTypeValue;
  quantity: number;
  referenceType?: string;
  referenceId?: string;
  notes?: string | null;
  createdByUserId: string;
  createdByName: string;
};

/** Ensure a balance-cache row exists for this (item, location) pair. Must be
 * called (or the row must already exist) before the conditional decrement
 * below, since `updateMany` matches zero rows for a missing row. Uses
 * `upsert` (a single INSERT ... ON CONFLICT statement) rather than
 * create()-and-catch-P2002: a caught statement error still poisons the
 * enclosing Postgres transaction (25P02, "current transaction is aborted")
 * for every later query in the same `$transaction` callback, even though
 * the JS exception itself is caught. */
async function ensureBalanceRow(tx: Prisma.TransactionClient, itemId: string, locationId: string): Promise<void> {
  await tx.inventoryStockBalance.upsert({
    where: { itemId_locationId: { itemId, locationId } },
    create: { itemId, locationId, quantity: 0 },
    update: {},
  });
}

/**
 * Insert one ledger movement AND atomically update the balance cache in the
 * same transaction. Outbound movements are conditionally applied — an
 * `updateMany` guarded by `quantity >= amount` — so two concurrent
 * outbound movements against the same (item, location) can never both
 * succeed past the point where stock would go negative; the loser gets
 * INSUFFICIENT_STOCK and the caller's transaction rolls back.
 */
export async function postMovement(tx: Prisma.TransactionClient, input: MovementInput): Promise<{ id: string }> {
  if (input.quantity <= 0) throw new HttpError("VALIDATION_ERROR", "Quantity must be positive");
  await ensureBalanceRow(tx, input.itemId, input.locationId);

  if (isInbound(input.movementType)) {
    await tx.inventoryStockBalance.update({
      where: { itemId_locationId: { itemId: input.itemId, locationId: input.locationId } },
      data: { quantity: { increment: input.quantity } },
    });
  } else {
    const updated = await tx.inventoryStockBalance.updateMany({
      where: { itemId: input.itemId, locationId: input.locationId, quantity: { gte: input.quantity } },
      data: { quantity: { decrement: input.quantity } },
    });
    if (updated.count === 0) throw new HttpError("INSUFFICIENT_STOCK", "Insufficient stock at this location");
  }

  const movement = await tx.inventoryStockMovement.create({
    data: {
      tenantId: input.tenantId, schoolId: input.schoolId, branchId: input.branchId,
      itemId: input.itemId, locationId: input.locationId,
      movementType: input.movementType as never, quantity: input.quantity,
      referenceType: input.referenceType, referenceId: input.referenceId, notes: input.notes,
      createdByUserId: input.createdByUserId, createdByName: input.createdByName,
    },
    select: { id: true },
  });
  return movement;
}

/** Current stock at one (item, location) pair, from the balance cache. */
export async function getLocationStock(tx: Prisma.TransactionClient, itemId: string, locationId: string): Promise<number> {
  const row = await tx.inventoryStockBalance.findUnique({ where: { itemId_locationId: { itemId, locationId } }, select: { quantity: true } });
  return row?.quantity ?? 0;
}
