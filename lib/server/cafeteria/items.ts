// Cafeteria Items (Phase 9T) — the real menu-item catalog. dietaryTags are
// informational only, never a medical/allergy authority. priceMinorUnits,
// if set, is informational display text only — never posted to Fees or
// Accounting (no financial collection is implemented in this phase).
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { CafeteriaItemDto } from "@/lib/api/contracts";

type Row = {
  id: string; code: string; name: string; category: string | null; description: string | null;
  dietaryTags: string[]; priceMinorUnits: number | null; status: string; createdAt: Date; updatedAt: Date;
};

const select = {
  id: true, code: true, name: true, category: true, description: true, dietaryTags: true, priceMinorUnits: true, status: true, createdAt: true, updatedAt: true,
} satisfies Prisma.CafeteriaItemSelect;

function dto(r: Row): CafeteriaItemDto {
  return {
    id: r.id, code: r.code, name: r.name, category: r.category, description: r.description,
    dietaryTags: r.dietaryTags, priceMinorUnits: r.priceMinorUnits,
    status: r.status.toLowerCase() as CafeteriaItemDto["status"],
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  };
}

export async function listItems(scope: OrgScope, params: { status?: string; search?: string } = {}): Promise<CafeteriaItemDto[]> {
  const where: Prisma.CafeteriaItemWhereInput = { schoolId: scope.schoolId };
  if (params.status) where.status = params.status.toUpperCase() as never;
  if (params.search?.trim()) where.name = { contains: params.search.trim(), mode: "insensitive" };
  const rows = await prisma.cafeteriaItem.findMany({ where, select, orderBy: { name: "asc" } });
  return rows.map(dto);
}

async function requireItemRow(scope: OrgScope, itemId: string): Promise<Row> {
  const row = await prisma.cafeteriaItem.findFirst({ where: { id: itemId, schoolId: scope.schoolId }, select });
  if (!row) throw new HttpError("CAFETERIA_ITEM_NOT_FOUND", "Item not found");
  return row;
}

export async function getItem(scope: OrgScope, itemId: string): Promise<CafeteriaItemDto> {
  return dto(await requireItemRow(scope, itemId));
}

export async function requireItemInScope(scope: OrgScope, itemId: string): Promise<{ id: string; status: string }> {
  const row = await prisma.cafeteriaItem.findFirst({ where: { id: itemId, schoolId: scope.schoolId }, select: { id: true, status: true } });
  if (!row) throw new HttpError("CAFETERIA_ITEM_NOT_FOUND", "Item not found");
  return row;
}

export const createItemSchema = z.object({
  code: z.string().trim().min(1).max(24),
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().max(40).optional(),
  description: z.string().trim().max(300).optional(),
  dietaryTags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
  priceMinorUnits: z.number().int().min(0).max(100_000_00).optional(),
});

export async function createItem(scope: OrgScope, raw: unknown): Promise<CafeteriaItemDto> {
  const input = parseInput(createItemSchema, raw);
  let row;
  try {
    row = await prisma.cafeteriaItem.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, code: input.code, name: input.name, category: input.category,
        description: input.description, dietaryTags: input.dietaryTags ?? [], priceMinorUnits: input.priceMinorUnits,
      },
      select,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError("CAFETERIA_ITEM_CODE_EXISTS", "An item with this code already exists");
    throw e;
  }
  await recordAudit(prisma, scope, "CAFETERIA_ITEM_CREATED", "CafeteriaItem", row.id, { code: row.code });
  return dto(row);
}

export const updateItemSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  category: z.string().trim().max(40).nullable().optional(),
  description: z.string().trim().max(300).nullable().optional(),
  dietaryTags: z.array(z.string().trim().min(1).max(30)).max(10).optional(),
  priceMinorUnits: z.number().int().min(0).max(100_000_00).nullable().optional(),
  status: z.enum(["active", "archived"]).optional(),
});

export async function updateItem(scope: OrgScope, itemId: string, raw: unknown): Promise<CafeteriaItemDto> {
  const input = parseInput(updateItemSchema, raw);
  await requireItemRow(scope, itemId);
  const row = await prisma.cafeteriaItem.update({
    where: { id: itemId },
    data: {
      name: input.name, category: input.category, description: input.description, dietaryTags: input.dietaryTags,
      priceMinorUnits: input.priceMinorUnits, status: input.status ? (input.status.toUpperCase() as never) : undefined,
    },
    select,
  });
  await recordAudit(prisma, scope, "CAFETERIA_ITEM_UPDATED", "CafeteriaItem", itemId, {});
  return dto(row);
}
