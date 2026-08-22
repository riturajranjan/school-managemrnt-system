// Cafeteria Meal Service (Phase 9T) — a factual record that a real Student
// or Staff member was served a meal from a published menu. Never called
// Attendance — meal consumption is a separate operational fact from
// academic/staff attendance, and never mutates either. Policy: one meal
// redemption per consumer per menu slot (see prisma/schema.prisma's
// CafeteriaMealRecord doc-comment for the exact reasoning).
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { CafeteriaMealRecordDto, CafeteriaMealTypeDto } from "@/lib/api/contracts";
import { requireValidConsumer, staffDisplayName, studentDisplayName } from "./access";
import { requireMenuInScope } from "./menus";

const MEAL_TYPE_TO_DTO: Record<string, CafeteriaMealTypeDto> = {
  BREAKFAST: "breakfast", LUNCH: "lunch", SNACKS: "snacks", DINNER: "dinner", A_LA_CARTE: "a-la-carte",
};

type Row = {
  id: string; menuId: string; cafeteriaItemId: string | null; studentId: string | null; staffId: string | null;
  servedAt: Date; quantity: number; servedByUserId: string; notes: string | null; createdAt: Date;
  menu: { date: Date; mealType: string };
  item: { name: string } | null;
  student: { firstName: string; lastName: string | null; admissionNumber: string } | null;
  staffPatient: { firstName: string; lastName: string | null; displayName: string | null; employeeCode: string } | null;
};

const select = {
  id: true, menuId: true, cafeteriaItemId: true, studentId: true, staffId: true, servedAt: true, quantity: true, servedByUserId: true, notes: true, createdAt: true,
  menu: { select: { date: true, mealType: true } },
  item: { select: { name: true } },
  student: { select: { firstName: true, lastName: true, admissionNumber: true } },
  staffPatient: { select: { firstName: true, lastName: true, displayName: true, employeeCode: true } },
} satisfies Prisma.CafeteriaMealRecordSelect;

function dto(r: Row): CafeteriaMealRecordDto {
  const isStudent = Boolean(r.studentId);
  return {
    id: r.id, menuId: r.menuId, menuDate: r.menu.date.toISOString().slice(0, 10), mealType: MEAL_TYPE_TO_DTO[r.menu.mealType],
    cafeteriaItemId: r.cafeteriaItemId, itemName: r.item?.name ?? null,
    consumerType: isStudent ? "student" : "staff", consumerId: (r.studentId ?? r.staffId)!,
    consumerName: isStudent ? studentDisplayName(r.student!) : staffDisplayName(r.staffPatient!),
    consumerRef: isStudent ? r.student!.admissionNumber : r.staffPatient!.employeeCode,
    servedAt: r.servedAt.toISOString(), quantity: r.quantity, servedByUserId: r.servedByUserId, notes: r.notes, createdAt: r.createdAt.toISOString(),
  };
}

export async function listMeals(
  scope: OrgScope,
  params: { menuId?: string; studentId?: string; staffId?: string; dateFrom?: string; dateTo?: string; page?: number; pageSize?: number } = {},
): Promise<{ items: CafeteriaMealRecordDto[]; total: number }> {
  const where: Prisma.CafeteriaMealRecordWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.menuId) where.menuId = params.menuId;
  if (params.studentId) where.studentId = params.studentId;
  if (params.staffId) where.staffId = params.staffId;
  if (params.dateFrom || params.dateTo) {
    where.servedAt = {
      ...(params.dateFrom ? { gte: new Date(`${params.dateFrom}T00:00:00.000Z`) } : {}),
      ...(params.dateTo ? { lte: new Date(`${params.dateTo}T23:59:59.999Z`) } : {}),
    };
  }
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const [rows, total] = await Promise.all([
    prisma.cafeteriaMealRecord.findMany({ where, select, orderBy: { servedAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.cafeteriaMealRecord.count({ where }),
  ]);
  return { items: rows.map(dto), total };
}

async function requireMealRow(scope: OrgScope, mealRecordId: string): Promise<Row> {
  const row = await prisma.cafeteriaMealRecord.findFirst({ where: { id: mealRecordId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select });
  if (!row) throw new HttpError("CAFETERIA_MEAL_RECORD_NOT_FOUND", "Meal record not found");
  return row;
}

export async function getMeal(scope: OrgScope, mealRecordId: string): Promise<CafeteriaMealRecordDto> {
  return dto(await requireMealRow(scope, mealRecordId));
}

export const recordMealSchema = z.object({
  menuId: z.string().min(1),
  studentId: z.string().min(1).optional(),
  staffId: z.string().min(1).optional(),
  cafeteriaItemId: z.string().min(1).optional(),
  quantity: z.number().int().min(1).max(20).optional(),
  notes: z.string().trim().max(300).optional(),
});

export async function recordMeal(scope: OrgScope, raw: unknown): Promise<CafeteriaMealRecordDto> {
  const input = parseInput(recordMealSchema, raw);
  const menuId = input.menuId;
  const menu = await requireMenuInScope(scope, menuId);
  const consumer = await requireValidConsumer(scope, input);
  if (input.cafeteriaItemId) {
    const item = await prisma.cafeteriaMenuItem.findFirst({ where: { menuId, cafeteriaItemId: input.cafeteriaItemId }, select: { id: true } });
    if (!item) throw new HttpError("CAFETERIA_ITEM_NOT_FOUND", "That item is not on this menu");
  }

  let recordId: string;
  try {
    recordId = await prisma.$transaction(async (tx) => {
      const row = await tx.cafeteriaMealRecord.create({
        data: {
          tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: menu.branchId, menuId,
          cafeteriaItemId: input.cafeteriaItemId, studentId: consumer.studentId, staffId: consumer.staffId,
          quantity: input.quantity ?? 1, servedByUserId: scope.actor.id, notes: input.notes,
        },
        select: { id: true },
      });
      await recordAudit(tx, scope, "CAFETERIA_MEAL_SERVED", "CafeteriaMealRecord", row.id, { menuId, consumerType: consumer.studentId ? "student" : "staff" });
      return row.id;
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError("CAFETERIA_MEAL_ALREADY_SERVED", "This consumer has already been served for this menu");
    throw e;
  }
  return getMeal(scope, recordId);
}
