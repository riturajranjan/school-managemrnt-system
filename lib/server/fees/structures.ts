// Fee Structures (Phase 9F) — real, PostgreSQL-backed. One structure targets
// one or more real Class rows (never a class name) within one real
// AcademicSession. Items are flat: each already carries its own dueDate, so
// there is no separate installment/component split (see the schema doc
// comment for the full scoping rationale). Structural edits (items/classes)
// are only allowed while DRAFT — once ANY StudentFeeAssignment references
// this structure, it is financially live and items become read-only; only
// status transitions (ACTIVE/ARCHIVED) remain possible.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { CreateFeeStructureRequest, FeeStructureDetailDto, FeeStructureListItemDto, FeeStructureStatusDto } from "@/lib/api/contracts";
import { dec } from "./money";
import { isBroadFeeManager } from "./access";

function requireSession(scope: OrgScope): string {
  if (!scope.academicSessionId) throw new HttpError("INVALID_SESSION", "Select an academic session first");
  return scope.academicSessionId;
}

const STATUS_TO_DB: Record<FeeStructureStatusDto, string> = { draft: "DRAFT", active: "ACTIVE", archived: "ARCHIVED" };
const statusToUi = (s: string): FeeStructureStatusDto => s.toLowerCase() as FeeStructureStatusDto;
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");
const parseDate = (d: string) => new Date(`${d}T00:00:00.000Z`);
const dateToUi = (d: Date) => d.toISOString().slice(0, 10);

const itemSchema = z.object({ categoryId: z.string().min(1), name: z.string().trim().max(120).optional(), amount: z.number().positive().max(10_000_000), dueDate: dateStr, order: z.number().int().min(0).optional() });

export const createFeeStructureSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  classIds: z.array(z.string().min(1)).min(1),
  items: z.array(itemSchema).min(1),
});
export const updateFeeStructureSchema = createFeeStructureSchema.partial();

const listSelect = {
  id: true, name: true, description: true, academicSessionId: true, status: true, currency: true,
  items: { select: { amount: true } },
  classes: { select: { classId: true, class: { select: { name: true } } } },
} satisfies Prisma.FeeStructureSelect;

function listDto(s: Prisma.FeeStructureGetPayload<{ select: typeof listSelect }>): FeeStructureListItemDto {
  return {
    id: s.id, name: s.name, academicSessionId: s.academicSessionId, status: statusToUi(s.status), currency: s.currency,
    totalAmount: s.items.reduce((sum, i) => sum + dec(i.amount), 0),
    classIds: s.classes.map((c) => c.classId), classNames: s.classes.map((c) => c.class.name),
  };
}

export async function listFeeStructures(scope: OrgScope, params: { status?: FeeStructureStatusDto } = {}): Promise<FeeStructureListItemDto[]> {
  const sessionId = requireSession(scope);
  const rows = await prisma.feeStructure.findMany({
    where: { schoolId: scope.schoolId, academicSessionId: sessionId, ...(params.status ? { status: STATUS_TO_DB[params.status] as never } : {}) },
    orderBy: { createdAt: "desc" },
    select: listSelect,
  });
  return rows.map(listDto);
}

async function requireStructureInScope(scope: OrgScope, structureId: string) {
  const row = await prisma.feeStructure.findFirst({
    where: { id: structureId, schoolId: scope.schoolId },
    select: { id: true, status: true, _count: { select: { assignments: true } } },
  });
  if (!row) throw new HttpError("FEE_STRUCTURE_NOT_FOUND", "Fee structure not found");
  return row;
}

export async function getFeeStructure(scope: OrgScope, structureId: string): Promise<FeeStructureDetailDto> {
  await requireStructureInScope(scope, structureId);
  const s = await prisma.feeStructure.findUniqueOrThrow({
    where: { id: structureId },
    select: { ...listSelect, items: { orderBy: { order: "asc" }, select: { id: true, categoryId: true, category: { select: { name: true } }, name: true, amount: true, dueDate: true, order: true } } },
  });
  return {
    ...listDto(s),
    description: s.description,
    items: s.items.map((i) => ({ id: i.id, categoryId: i.categoryId, categoryName: i.category.name, name: i.name, amount: dec(i.amount), dueDate: dateToUi(i.dueDate), order: i.order })),
  };
}

/** Resolve the branch a new structure belongs to (active branch, else single ACTIVE) — mirrors lib/server/staff/service.ts's resolveStaffBranch. */
async function resolveStructureBranch(scope: OrgScope): Promise<string> {
  if (scope.branchId) return scope.branchId;
  const active = await prisma.branch.findMany({ where: { schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (active.length === 1) return active[0].id;
  throw new HttpError("INVALID_BRANCH", "Select a branch for this fee structure");
}

async function validateClassesAndCategories(scope: OrgScope, sessionId: string, classIds: string[], items: CreateFeeStructureRequest["items"]) {
  const classes = await prisma.class.findMany({ where: { id: { in: classIds }, schoolId: scope.schoolId, academicSessionId: sessionId }, select: { id: true } });
  if (classes.length !== new Set(classIds).size) throw new HttpError("INVALID_FEE_STRUCTURE", "One or more classes were not found in this session");
  const categoryIds = [...new Set(items.map((i) => i.categoryId))];
  const categories = await prisma.feeCategory.findMany({ where: { id: { in: categoryIds }, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (categories.length !== categoryIds.length) throw new HttpError("INVALID_FEE_STRUCTURE", "One or more fee categories were not found or are archived");
}

export async function createFeeStructure(scope: OrgScope, raw: unknown): Promise<FeeStructureDetailDto> {
  if (!(await isBroadFeeManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input = parseInput(createFeeStructureSchema, raw);
  const sessionId = requireSession(scope);
  await validateClassesAndCategories(scope, sessionId, input.classIds, input.items);

  const dupName = await prisma.feeStructure.findFirst({ where: { schoolId: scope.schoolId, academicSessionId: sessionId, name: { equals: input.name, mode: "insensitive" } }, select: { id: true } });
  if (dupName) throw new HttpError("INVALID_FEE_STRUCTURE", "A fee structure with this name already exists for this session");

  const branchId = await resolveStructureBranch(scope);
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.feeStructure.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId,
        academicSessionId: sessionId, name: input.name, description: input.description ?? null,
        createdByUserId: scope.actor.id, createdByName: scope.actor.name,
        classes: { create: input.classIds.map((classId) => ({ classId })) },
        items: { create: input.items.map((i, idx) => ({ categoryId: i.categoryId, name: i.name ?? null, amount: i.amount, dueDate: parseDate(i.dueDate), order: i.order ?? idx })) },
      },
      select: { id: true },
    });
    await recordAudit(tx, scope, "FEE_STRUCTURE_CREATED", "FeeStructure", row.id, { name: input.name });
    return row;
  });
  return getFeeStructure(scope, created.id);
}

export async function updateFeeStructure(scope: OrgScope, structureId: string, raw: unknown): Promise<FeeStructureDetailDto> {
  if (!(await isBroadFeeManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const existing = await requireStructureInScope(scope, structureId);
  if (existing._count.assignments > 0) throw new HttpError("FEE_STRUCTURE_NOT_EDITABLE", "This structure already has student assignments and can no longer be structurally edited");
  const input = parseInput(updateFeeStructureSchema, raw);
  const sessionId = requireSession(scope);
  if (input.classIds) await validateClassesAndCategories(scope, sessionId, input.classIds, input.items ?? []);
  else if (input.items) await validateClassesAndCategories(scope, sessionId, [], input.items);

  await prisma.$transaction(async (tx) => {
    await tx.feeStructure.update({ where: { id: structureId }, data: { name: input.name, description: input.description === undefined ? undefined : input.description ?? null } });
    if (input.classIds) {
      await tx.feeStructureClass.deleteMany({ where: { feeStructureId: structureId } });
      await tx.feeStructureClass.createMany({ data: input.classIds.map((classId) => ({ feeStructureId: structureId, classId })) });
    }
    if (input.items) {
      await tx.feeStructureItem.deleteMany({ where: { feeStructureId: structureId } });
      await tx.feeStructureItem.createMany({ data: input.items.map((i, idx) => ({ feeStructureId: structureId, categoryId: i.categoryId, name: i.name ?? null, amount: i.amount, dueDate: parseDate(i.dueDate), order: i.order ?? idx })) });
    }
    await recordAudit(tx, scope, "FEE_STRUCTURE_UPDATED", "FeeStructure", structureId);
  });
  return getFeeStructure(scope, structureId);
}

export const setFeeStructureStatusSchema = z.object({ status: z.enum(["draft", "active", "archived"]) });

export async function setFeeStructureStatus(scope: OrgScope, structureId: string, raw: unknown): Promise<FeeStructureDetailDto> {
  if (!(await isBroadFeeManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input = parseInput(setFeeStructureStatusSchema, raw);
  await requireStructureInScope(scope, structureId);
  await prisma.$transaction(async (tx) => {
    await tx.feeStructure.update({ where: { id: structureId }, data: { status: STATUS_TO_DB[input.status] as never } });
    await recordAudit(tx, scope, "FEE_STRUCTURE_STATUS_CHANGED", "FeeStructure", structureId, { status: input.status });
  });
  return getFeeStructure(scope, structureId);
}
