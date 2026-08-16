// Fee Categories (Phase 9F) — real, PostgreSQL-backed. Archival (not delete)
// is the only lifecycle: a FeeStructureItem/FeeCharge snapshot survives a
// category rename or archive untouched (see the schema doc comment).
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { FeeCategoryDto } from "@/lib/api/contracts";
import { isBroadFeeManager } from "./access";

function toDto(c: { id: string; name: string; code: string; description: string | null; status: string }): FeeCategoryDto {
  return { id: c.id, name: c.name, code: c.code, description: c.description, status: c.status === "ACTIVE" ? "active" : "archived" };
}

export async function listFeeCategories(scope: OrgScope, includeArchived = false): Promise<FeeCategoryDto[]> {
  const rows = await prisma.feeCategory.findMany({ where: { schoolId: scope.schoolId, ...(includeArchived ? {} : { status: "ACTIVE" }) }, orderBy: { name: "asc" } });
  return rows.map(toDto);
}

export const createFeeCategorySchema = z.object({ name: z.string().trim().min(1).max(80), code: z.string().trim().min(1).max(20), description: z.string().trim().max(500).optional() });

export async function createFeeCategory(scope: OrgScope, raw: unknown): Promise<FeeCategoryDto> {
  if (!(await isBroadFeeManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input = parseInput(createFeeCategorySchema, raw);
  const clash = await prisma.feeCategory.findFirst({ where: { schoolId: scope.schoolId, code: { equals: input.code, mode: "insensitive" } }, select: { id: true } });
  if (clash) throw new HttpError("FEE_CATEGORY_CODE_EXISTS", "A fee category with this code already exists");
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.feeCategory.create({ data: { tenantId: scope.tenantId, schoolId: scope.schoolId, name: input.name, code: input.code, description: input.description ?? null } });
    await recordAudit(tx, scope, "FEE_CATEGORY_CREATED", "FeeCategory", row.id, { name: row.name });
    return row;
  });
  return toDto(created);
}

export const updateFeeCategorySchema = z.object({ name: z.string().trim().min(1).max(80).optional(), description: z.string().trim().max(500).optional(), status: z.enum(["active", "archived"]).optional() });

export async function updateFeeCategory(scope: OrgScope, categoryId: string, raw: unknown): Promise<FeeCategoryDto> {
  if (!(await isBroadFeeManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input = parseInput(updateFeeCategorySchema, raw);
  const existing = await prisma.feeCategory.findFirst({ where: { id: categoryId, schoolId: scope.schoolId }, select: { id: true } });
  if (!existing) throw new HttpError("FEE_CATEGORY_NOT_FOUND", "Fee category not found");
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.feeCategory.update({ where: { id: categoryId }, data: { name: input.name, description: input.description, status: input.status ? (input.status === "active" ? "ACTIVE" : "ARCHIVED") : undefined } });
    await recordAudit(tx, scope, "FEE_CATEGORY_UPDATED", "FeeCategory", categoryId);
    return row;
  });
  return toDto(updated);
}
