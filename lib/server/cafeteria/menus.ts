// Cafeteria Menus (Phase 9T) — a real published menu per serving slot
// (location + date + mealType). No draft/publish lifecycle — a created menu
// is immediately live (the old mock's weekly planner had no such concept,
// and inventing an approval workflow is out of scope). Menu identity uses
// real date semantics (never createdAt) and is concurrency-safe via a real
// DB unique constraint on (locationId, date, mealType).
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { CafeteriaMealTypeDto, CafeteriaMenuDetailDto, CafeteriaMenuDto } from "@/lib/api/contracts";
import { resolveDefaultLocation } from "./access";
import { requireLocationInScope } from "./locations";

const MEAL_TYPE_TO_DB: Record<CafeteriaMealTypeDto, string> = {
  breakfast: "BREAKFAST", lunch: "LUNCH", snacks: "SNACKS", dinner: "DINNER", "a-la-carte": "A_LA_CARTE",
};
const MEAL_TYPE_TO_DTO: Record<string, CafeteriaMealTypeDto> = {
  BREAKFAST: "breakfast", LUNCH: "lunch", SNACKS: "snacks", DINNER: "dinner", A_LA_CARTE: "a-la-carte",
};

type Row = {
  id: string; locationId: string; date: Date; mealType: string; createdAt: Date; updatedAt: Date;
  location: { name: string };
  _count: { items: number };
};

const select = {
  id: true, locationId: true, date: true, mealType: true, createdAt: true, updatedAt: true,
  location: { select: { name: true } },
  _count: { select: { items: true } },
} satisfies Prisma.CafeteriaMenuSelect;

function dto(m: Row): CafeteriaMenuDto {
  return {
    id: m.id, locationId: m.locationId, locationName: m.location.name, date: m.date.toISOString().slice(0, 10),
    mealType: MEAL_TYPE_TO_DTO[m.mealType], itemCount: m._count.items,
    createdAt: m.createdAt.toISOString(), updatedAt: m.updatedAt.toISOString(),
  };
}

export async function listMenus(scope: OrgScope, params: { locationId?: string; date?: string; dateFrom?: string; dateTo?: string; mealType?: string } = {}): Promise<CafeteriaMenuDto[]> {
  const where: Prisma.CafeteriaMenuWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.locationId) where.locationId = params.locationId;
  if (params.mealType) where.mealType = MEAL_TYPE_TO_DB[params.mealType as CafeteriaMealTypeDto] as never;
  if (params.date) where.date = new Date(`${params.date}T00:00:00.000Z`);
  else if (params.dateFrom || params.dateTo) {
    where.date = {
      ...(params.dateFrom ? { gte: new Date(`${params.dateFrom}T00:00:00.000Z`) } : {}),
      ...(params.dateTo ? { lte: new Date(`${params.dateTo}T00:00:00.000Z`) } : {}),
    };
  }
  const rows = await prisma.cafeteriaMenu.findMany({ where, select, orderBy: [{ date: "desc" }, { mealType: "asc" }] });
  return rows.map(dto);
}

async function requireMenuRow(scope: OrgScope, menuId: string): Promise<Row> {
  const row = await prisma.cafeteriaMenu.findFirst({ where: { id: menuId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select });
  if (!row) throw new HttpError("CAFETERIA_MENU_NOT_FOUND", "Menu not found");
  return row;
}

export async function requireMenuInScope(scope: OrgScope, menuId: string): Promise<{ id: string; locationId: string; branchId: string }> {
  const row = await prisma.cafeteriaMenu.findFirst({ where: { id: menuId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: { id: true, locationId: true, branchId: true } });
  if (!row) throw new HttpError("CAFETERIA_MENU_NOT_FOUND", "Menu not found");
  return row;
}

export async function getMenu(scope: OrgScope, menuId: string): Promise<CafeteriaMenuDto> {
  return dto(await requireMenuRow(scope, menuId));
}

export async function getMenuDetail(scope: OrgScope, menuId: string): Promise<CafeteriaMenuDetailDto> {
  const row = await requireMenuRow(scope, menuId);
  const items = await prisma.cafeteriaMenuItem.findMany({
    where: { menuId },
    select: { id: true, cafeteriaItemId: true, servingOrder: true, item: { select: { name: true, category: true, dietaryTags: true, priceMinorUnits: true } } },
    orderBy: { servingOrder: "asc" },
  });
  return {
    ...dto(row),
    items: items.map((i) => ({ id: i.id, cafeteriaItemId: i.cafeteriaItemId, name: i.item.name, category: i.item.category, dietaryTags: i.item.dietaryTags, priceMinorUnits: i.item.priceMinorUnits, servingOrder: i.servingOrder })),
  };
}

export const createMenuSchema = z.object({
  locationId: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealType: z.enum(["breakfast", "lunch", "snacks", "dinner", "a-la-carte"]),
  itemIds: z.array(z.string().min(1)).max(50).optional(),
});

export async function createMenu(scope: OrgScope, raw: unknown): Promise<CafeteriaMenuDto> {
  const input = parseInput(createMenuSchema, raw);
  const locationId = input.locationId ? (await requireLocationInScope(scope, input.locationId)).id : await resolveDefaultLocation(scope);
  const branchId = (await prisma.cafeteriaLocation.findUniqueOrThrow({ where: { id: locationId }, select: { branchId: true } })).branchId;

  let menuId: string;
  try {
    menuId = await prisma.$transaction(async (tx) => {
      const menu = await tx.cafeteriaMenu.create({
        data: { tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, locationId, date: new Date(`${input.date}T00:00:00.000Z`), mealType: MEAL_TYPE_TO_DB[input.mealType] as never, createdByUserId: scope.actor.id },
        select: { id: true },
      });
      if (input.itemIds?.length) {
        const validItems = await tx.cafeteriaItem.findMany({ where: { id: { in: input.itemIds }, schoolId: scope.schoolId }, select: { id: true } });
        await tx.cafeteriaMenuItem.createMany({
          data: validItems.map((it, i) => ({ tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, menuId: menu.id, cafeteriaItemId: it.id, servingOrder: i })),
        });
      }
      await recordAudit(tx, scope, "CAFETERIA_MENU_CREATED", "CafeteriaMenu", menu.id, { date: input.date, mealType: input.mealType });
      return menu.id;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError("CAFETERIA_MENU_SLOT_EXISTS", "A menu already exists for this location, date, and meal type");
    throw e;
  }
  return getMenu(scope, menuId);
}

export const setMenuItemsSchema = z.object({ itemIds: z.array(z.string().min(1)).max(50) });

export async function setMenuItems(scope: OrgScope, menuId: string, raw: unknown): Promise<CafeteriaMenuDetailDto> {
  const input = parseInput(setMenuItemsSchema, raw);
  const menu = await requireMenuInScope(scope, menuId);
  const validItems = await prisma.cafeteriaItem.findMany({ where: { id: { in: input.itemIds }, schoolId: scope.schoolId }, select: { id: true } });

  await prisma.$transaction(async (tx) => {
    await tx.cafeteriaMenuItem.deleteMany({ where: { menuId } });
    if (validItems.length) {
      await tx.cafeteriaMenuItem.createMany({
        data: validItems.map((it, i) => ({ tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: menu.branchId, menuId, cafeteriaItemId: it.id, servingOrder: i })),
      });
    }
    await recordAudit(tx, scope, "CAFETERIA_MENU_UPDATED", "CafeteriaMenu", menuId, { itemCount: validItems.length });
  });
  return getMenuDetail(scope, menuId);
}
