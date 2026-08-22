// Inventory Items (Phase 9O) — the consumable catalog. `quantity`/`status`
// on the DTO are always computed live from the stock-balance cache (which is
// itself kept in lockstep with the ledger by ledger.ts) — never a stored,
// separately-mutated column.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { InventoryItemDto, InventoryItemStatusDto } from "@/lib/api/contracts";
import { resolveInventoryBranch } from "./access";
import { getItemStockMap, getItemTotalStock } from "./stock";

type Row = { id: string; code: string; name: string; description: string | null; category: string | null; unit: string; reorderLevel: number | null; status: string; createdAt: Date; updatedAt: Date };

function statusFor(dbStatus: string, quantity: number, reorderLevel: number | null): InventoryItemStatusDto {
  if (dbStatus === "ARCHIVED") return "discontinued";
  if (quantity <= 0) return "out-of-stock";
  if (reorderLevel !== null && quantity <= reorderLevel) return "low-stock";
  return "in-stock";
}

function dto(r: Row, quantity: number): InventoryItemDto {
  return {
    id: r.id, code: r.code, name: r.name, description: r.description, category: r.category, unit: r.unit,
    reorderLevel: r.reorderLevel, quantity, status: statusFor(r.status, quantity, r.reorderLevel),
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  };
}

export async function listItems(scope: OrgScope, params: { search?: string; status?: string; category?: string } = {}): Promise<InventoryItemDto[]> {
  const where: Prisma.InventoryItemWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.status) where.status = params.status.toUpperCase() as never;
  if (params.category) where.category = params.category;
  if (params.search) where.OR = [{ name: { contains: params.search, mode: "insensitive" } }, { code: { contains: params.search, mode: "insensitive" } }];
  const rows = await prisma.inventoryItem.findMany({ where, orderBy: { name: "asc" } });
  const stockMap = await getItemStockMap(scope, rows.map((r) => r.id));
  return rows.map((r) => dto(r, stockMap.get(r.id) ?? 0));
}

export async function listCategories(scope: OrgScope): Promise<{ category: string; count: number }[]> {
  const grouped = await prisma.inventoryItem.groupBy({
    by: ["category"],
    where: { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}), category: { not: null } },
    _count: { _all: true },
  });
  return grouped.map((g) => ({ category: g.category as string, count: g._count._all })).sort((a, b) => a.category.localeCompare(b.category));
}

async function requireItemRow(scope: OrgScope, itemId: string): Promise<Row> {
  const row = await prisma.inventoryItem.findFirst({ where: { id: itemId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) } });
  if (!row) throw new HttpError("INVENTORY_ITEM_NOT_FOUND", "Item not found");
  return row;
}

export async function getItem(scope: OrgScope, itemId: string): Promise<InventoryItemDto> {
  const row = await requireItemRow(scope, itemId);
  const quantity = await getItemTotalStock(scope, itemId);
  return dto(row, quantity);
}

export const createItemSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500).optional(),
  category: z.string().trim().max(80).optional(),
  unit: z.string().trim().min(1).max(20),
  reorderLevel: z.number().int().min(0).optional(),
  openingQuantity: z.number().int().min(0).optional(),
  locationId: z.string().min(1).optional(),
});

export async function createItem(scope: OrgScope, raw: unknown): Promise<InventoryItemDto> {
  const input = parseInput(createItemSchema, raw);
  const branchId = await resolveInventoryBranch(scope);

  let item;
  try {
    item = await prisma.inventoryItem.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId,
        code: input.code, name: input.name, description: input.description, category: input.category,
        unit: input.unit, reorderLevel: input.reorderLevel ?? null,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError("INVENTORY_ITEM_CODE_EXISTS", "An item with this code already exists");
    throw e;
  }
  await recordAudit(prisma, scope, "INVENTORY_ITEM_CREATED", "InventoryItem", item.id, { code: item.code, name: item.name });

  if (input.openingQuantity && input.openingQuantity > 0) {
    const { postOpeningStock } = await import("./movements");
    await postOpeningStock(scope, item.id, input.openingQuantity, input.locationId);
  }
  return getItem(scope, item.id);
}

export const updateItemSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  category: z.string().trim().max(80).nullable().optional(),
  unit: z.string().trim().min(1).max(20).optional(),
  reorderLevel: z.number().int().min(0).nullable().optional(),
  status: z.enum(["active", "archived"]).optional(),
});

export async function updateItem(scope: OrgScope, itemId: string, raw: unknown): Promise<InventoryItemDto> {
  const input = parseInput(updateItemSchema, raw);
  await requireItemRow(scope, itemId);
  await prisma.inventoryItem.update({
    where: { id: itemId },
    data: {
      name: input.name, description: input.description, category: input.category, unit: input.unit,
      reorderLevel: input.reorderLevel, status: input.status ? (input.status.toUpperCase() as never) : undefined,
    },
  });
  await recordAudit(prisma, scope, "INVENTORY_ITEM_UPDATED", "InventoryItem", itemId, input);
  return getItem(scope, itemId);
}
