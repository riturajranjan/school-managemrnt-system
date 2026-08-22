// Inventory stock movements: Receipts + the movement history feed (Phase 9O).
// Issues/Returns live in issues.ts, Transfers in transfers.ts, Adjustments in
// adjustments.ts — each posts through ledger.ts's postMovement().
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { OrgScope } from "@/lib/server/api/scope";
import type { InventoryMovementDto } from "@/lib/api/contracts";
import type { ListMeta } from "@/lib/server/api/response";
import { resolveInventoryBranch } from "./access";
import { getOrCreateDefaultLocation, requireLocationInScope } from "./locations";
import { postMovement } from "./ledger";

type Row = {
  id: string; itemId: string; locationId: string; movementType: string; quantity: number;
  referenceType: string | null; referenceId: string | null; notes: string | null;
  createdByName: string; createdAt: Date;
  item: { name: string; code: string };
  location: { name: string };
};

const select = {
  id: true, itemId: true, locationId: true, movementType: true, quantity: true,
  referenceType: true, referenceId: true, notes: true, createdByName: true, createdAt: true,
  item: { select: { name: true, code: true } },
  location: { select: { name: true } },
} satisfies Prisma.InventoryStockMovementSelect;

function dto(m: Row): InventoryMovementDto {
  const outbound = m.movementType === "ISSUE" || m.movementType === "TRANSFER_OUT" || m.movementType === "ADJUSTMENT_OUT";
  return {
    id: m.id, itemId: m.itemId, itemName: m.item.name, itemCode: m.item.code,
    locationId: m.locationId, locationName: m.location.name,
    movementType: m.movementType.toLowerCase().replace(/_/g, "-") as InventoryMovementDto["movementType"],
    quantityDelta: outbound ? -m.quantity : m.quantity,
    referenceType: m.referenceType, referenceId: m.referenceId, notes: m.notes,
    createdByName: m.createdByName, createdAt: m.createdAt.toISOString(),
  };
}

export async function listMovements(
  scope: OrgScope,
  params: { itemId?: string; locationId?: string; movementType?: string; from?: string; to?: string; page?: number; pageSize?: number } = {},
): Promise<{ data: InventoryMovementDto[]; meta: ListMeta }> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
  const where: Prisma.InventoryStockMovementWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.itemId) where.itemId = params.itemId;
  if (params.locationId) where.locationId = params.locationId;
  if (params.movementType) where.movementType = params.movementType.toUpperCase().replace(/-/g, "_") as never;
  if (params.from || params.to) {
    where.createdAt = {};
    if (params.from) where.createdAt.gte = new Date(`${params.from}T00:00:00.000Z`);
    if (params.to) where.createdAt.lte = new Date(`${params.to}T23:59:59.999Z`);
  }
  const [rows, total] = await Promise.all([
    prisma.inventoryStockMovement.findMany({ where, select, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.inventoryStockMovement.count({ where }),
  ]);
  return { data: rows.map(dto), meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
}

export async function listItemMovements(scope: OrgScope, itemId: string): Promise<InventoryMovementDto[]> {
  const { data } = await listMovements(scope, { itemId, pageSize: 100 });
  return data;
}

/** Opening stock — posted once at item creation, never again. */
export async function postOpeningStock(scope: OrgScope, itemId: string, quantity: number, locationId?: string): Promise<void> {
  const branchId = await resolveInventoryBranch(scope);
  const location = locationId ? await requireLocationInScope(scope, locationId) : await getOrCreateDefaultLocation(scope);
  await prisma.$transaction(async (tx) => {
    await postMovement(tx, {
      tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, itemId, locationId: location.id,
      movementType: "OPENING", quantity, notes: "Opening stock", createdByUserId: scope.actor.id, createdByName: scope.actor.name ?? "System",
    });
  });
}

export const receiveStockSchema = z.object({
  itemId: z.string().min(1),
  locationId: z.string().min(1).optional(),
  quantity: z.number().int().positive(),
  reference: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(500).optional(),
});

export async function receiveStock(scope: OrgScope, raw: unknown): Promise<InventoryMovementDto> {
  const input = parseInput(receiveStockSchema, raw);
  const branchId = await resolveInventoryBranch(scope);
  const item = await prisma.inventoryItem.findFirst({ where: { id: input.itemId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: { id: true } });
  if (!item) throw new HttpError("INVENTORY_ITEM_NOT_FOUND", "Item not found");
  const location = input.locationId ? await requireLocationInScope(scope, input.locationId) : await getOrCreateDefaultLocation(scope);

  const movementId = await prisma.$transaction(async (tx) => {
    const m = await postMovement(tx, {
      tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, itemId: input.itemId, locationId: location.id,
      movementType: "RECEIPT", quantity: input.quantity, referenceType: input.reference ? "Receipt" : undefined, notes: input.notes ?? input.reference,
      createdByUserId: scope.actor.id, createdByName: scope.actor.name ?? "System",
    });
    await recordAudit(tx, scope, "INVENTORY_STOCK_RECEIVED", "InventoryStockMovement", m.id, { itemId: input.itemId, quantity: input.quantity });
    return m.id;
  });

  const row = await prisma.inventoryStockMovement.findUniqueOrThrow({ where: { id: movementId }, select });
  return dto(row);
}
