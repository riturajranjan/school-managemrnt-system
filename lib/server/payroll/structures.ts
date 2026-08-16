// Salary Structures (Phase 9H) — real, PostgreSQL-backed reusable component
// bundles. Structural edits (the component line list) are only allowed while
// a structure has ZERO StaffSalaryAssignment rows — once assigned it is
// financially live and only name/description/status remain editable. This
// mirrors lib/server/fees/structures.ts's FeeStructure lock-on-assignment
// pattern exactly (see that file's doc comment for the precedent).
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { CreateSalaryStructureComponentInput, SalaryStructureDetailDto, SalaryStructureListItemDto, SalaryStructureStatusDto } from "@/lib/api/contracts";
import { dec } from "@/lib/server/fees/money";
import { isBroadPayrollManager, resolvePayrollBranch } from "./access";

const componentLineSchema = z.object({
  componentId: z.string().min(1),
  amount: z.number().min(0).max(10_000_000).optional(),
  percent: z.number().min(0).max(100).optional(),
  percentOfComponentId: z.string().min(1).optional(),
});

export const createSalaryStructureSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  components: z.array(componentLineSchema).min(1),
});
export const updateSalaryStructureSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  components: z.array(componentLineSchema).min(1).optional(),
});
export const setSalaryStructureStatusSchema = z.object({ status: z.enum(["active", "archived"]) });

const listSelect = {
  id: true, name: true, description: true, status: true,
  components: { select: { id: true } },
  _count: { select: { assignments: true } },
} satisfies Prisma.SalaryStructureSelect;

function listDto(s: Prisma.SalaryStructureGetPayload<{ select: typeof listSelect }>): SalaryStructureListItemDto {
  return { id: s.id, name: s.name, description: s.description, status: s.status === "ACTIVE" ? "active" : "archived", componentCount: s.components.length, assignmentCount: s._count.assignments };
}

export async function listSalaryStructures(scope: OrgScope, params: { status?: SalaryStructureStatusDto } = {}): Promise<SalaryStructureListItemDto[]> {
  const rows = await prisma.salaryStructure.findMany({ where: { schoolId: scope.schoolId, ...(params.status ? { status: params.status.toUpperCase() as never } : {}) }, orderBy: { name: "asc" }, select: listSelect });
  return rows.map(listDto);
}

async function requireStructureInScope(scope: OrgScope, structureId: string) {
  const row = await prisma.salaryStructure.findFirst({ where: { id: structureId, schoolId: scope.schoolId }, select: { id: true, status: true, _count: { select: { assignments: true } } } });
  if (!row) throw new HttpError("SALARY_STRUCTURE_NOT_FOUND", "Salary structure not found");
  return row;
}

export async function getSalaryStructure(scope: OrgScope, structureId: string): Promise<SalaryStructureDetailDto> {
  await requireStructureInScope(scope, structureId);
  const s = await prisma.salaryStructure.findUniqueOrThrow({
    where: { id: structureId },
    select: {
      ...listSelect,
      components: { orderBy: { order: "asc" }, select: { id: true, salaryComponentId: true, salaryComponent: { select: { code: true, name: true, type: true, calcType: true } }, amount: true, percent: true, percentOfLineId: true } },
    },
  });
  return {
    ...listDto(s),
    components: s.components.map((c) => ({
      id: c.id, componentId: c.salaryComponentId, componentCode: c.salaryComponent.code, componentName: c.salaryComponent.name,
      type: c.salaryComponent.type === "EARNING" ? "earning" : "deduction", calcType: c.salaryComponent.calcType === "FIXED" ? "fixed" : "percentage",
      amount: c.amount === null ? null : dec(c.amount), percent: c.percent === null ? null : dec(c.percent), percentOfLineId: c.percentOfLineId,
    })),
  };
}

/** Validates each line's calcType-matching fields and resolves
 * `percentOfComponentId` references to another line in the SAME list.
 * Returns the components ready to insert (percentOfLineId resolved after
 * insertion, in the caller, since ids don't exist yet). */
async function validateComponentLines(scope: OrgScope, lines: CreateSalaryStructureComponentInput[]) {
  const componentIds = lines.map((l) => l.componentId);
  if (new Set(componentIds).size !== componentIds.length) throw new HttpError("INVALID_SALARY_STRUCTURE", "A component cannot appear more than once in a structure");

  const components = await prisma.salaryComponent.findMany({ where: { id: { in: componentIds }, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true, calcType: true } });
  if (components.length !== componentIds.length) throw new HttpError("INVALID_SALARY_STRUCTURE", "One or more components were not found or are archived");
  const byId = new Map(components.map((c) => [c.id, c]));

  for (const line of lines) {
    const component = byId.get(line.componentId)!;
    if (component.calcType === "FIXED") {
      if (line.amount === undefined) throw new HttpError("INVALID_SALARY_STRUCTURE", "A fixed component requires an amount");
      if (line.percent !== undefined || line.percentOfComponentId !== undefined) throw new HttpError("INVALID_SALARY_STRUCTURE", "A fixed component cannot carry a percentage");
    } else {
      if (line.percent === undefined || line.percentOfComponentId === undefined) throw new HttpError("INVALID_SALARY_STRUCTURE", "A percentage component requires a percent and a base component");
      if (line.amount !== undefined) throw new HttpError("INVALID_SALARY_STRUCTURE", "A percentage component cannot carry a fixed amount");
      if (line.percentOfComponentId === line.componentId) throw new HttpError("INVALID_SALARY_STRUCTURE", "A component cannot be a percentage of itself");
      if (!componentIds.includes(line.percentOfComponentId)) throw new HttpError("INVALID_SALARY_STRUCTURE", "The percentage base must be another component within the same structure");
      // A percentage base must itself be FIXED — no percent-of-percent chains
      // to resolve (keeps the calculation a single deterministic pass).
      if (byId.get(line.percentOfComponentId)!.calcType !== "FIXED") throw new HttpError("INVALID_SALARY_STRUCTURE", "The percentage base must be a fixed-amount component");
    }
  }
}

export async function createSalaryStructure(scope: OrgScope, raw: unknown): Promise<SalaryStructureDetailDto> {
  if (!(await isBroadPayrollManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input = parseInput(createSalaryStructureSchema, raw);
  await validateComponentLines(scope, input.components);
  const dupName = await prisma.salaryStructure.findFirst({ where: { schoolId: scope.schoolId, name: { equals: input.name, mode: "insensitive" } }, select: { id: true } });
  if (dupName) throw new HttpError("SALARY_STRUCTURE_NAME_EXISTS", "A salary structure with this name already exists");
  const branchId = await resolvePayrollBranch(scope);

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.salaryStructure.create({
      data: { tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, name: input.name, description: input.description ?? null, createdByUserId: scope.actor.id, createdByName: scope.actor.name },
      select: { id: true },
    });
    const lineIdByComponentId = new Map<string, string>();
    for (const [idx, line] of input.components.entries()) {
      const created = await tx.salaryStructureComponent.create({
        data: { salaryStructureId: row.id, salaryComponentId: line.componentId, amount: line.amount ?? null, percent: line.percent ?? null, order: idx },
        select: { id: true },
      });
      lineIdByComponentId.set(line.componentId, created.id);
    }
    for (const line of input.components) {
      if (line.percentOfComponentId) {
        await tx.salaryStructureComponent.update({ where: { id: lineIdByComponentId.get(line.componentId)! }, data: { percentOfLineId: lineIdByComponentId.get(line.percentOfComponentId) } });
      }
    }
    await recordAudit(tx, scope, "SALARY_STRUCTURE_CREATED", "SalaryStructure", row.id, { name: input.name });
    return row;
  });
  return getSalaryStructure(scope, created.id);
}

export async function updateSalaryStructure(scope: OrgScope, structureId: string, raw: unknown): Promise<SalaryStructureDetailDto> {
  if (!(await isBroadPayrollManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const existing = await requireStructureInScope(scope, structureId);
  const input = parseInput(updateSalaryStructureSchema, raw);
  if (input.components && existing._count.assignments > 0) throw new HttpError("SALARY_STRUCTURE_NOT_EDITABLE", "This structure already has staff assignments and can no longer be structurally edited");
  if (input.components) await validateComponentLines(scope, input.components);
  if (input.name) {
    const dupName = await prisma.salaryStructure.findFirst({ where: { schoolId: scope.schoolId, name: { equals: input.name, mode: "insensitive" }, id: { not: structureId } }, select: { id: true } });
    if (dupName) throw new HttpError("SALARY_STRUCTURE_NAME_EXISTS", "A salary structure with this name already exists");
  }

  await prisma.$transaction(async (tx) => {
    await tx.salaryStructure.update({ where: { id: structureId }, data: { name: input.name, description: input.description === undefined ? undefined : input.description } });
    if (input.components) {
      await tx.salaryStructureComponent.deleteMany({ where: { salaryStructureId: structureId } });
      const lineIdByComponentId = new Map<string, string>();
      for (const [idx, line] of input.components.entries()) {
        const created = await tx.salaryStructureComponent.create({
          data: { salaryStructureId: structureId, salaryComponentId: line.componentId, amount: line.amount ?? null, percent: line.percent ?? null, order: idx },
          select: { id: true },
        });
        lineIdByComponentId.set(line.componentId, created.id);
      }
      for (const line of input.components) {
        if (line.percentOfComponentId) {
          await tx.salaryStructureComponent.update({ where: { id: lineIdByComponentId.get(line.componentId)! }, data: { percentOfLineId: lineIdByComponentId.get(line.percentOfComponentId) } });
        }
      }
    }
    await recordAudit(tx, scope, "SALARY_STRUCTURE_UPDATED", "SalaryStructure", structureId);
  });
  return getSalaryStructure(scope, structureId);
}

export async function setSalaryStructureStatus(scope: OrgScope, structureId: string, raw: unknown): Promise<SalaryStructureDetailDto> {
  if (!(await isBroadPayrollManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input = parseInput(setSalaryStructureStatusSchema, raw);
  await requireStructureInScope(scope, structureId);
  await prisma.$transaction(async (tx) => {
    await tx.salaryStructure.update({ where: { id: structureId }, data: { status: input.status === "active" ? "ACTIVE" : "ARCHIVED" } });
    await recordAudit(tx, scope, "SALARY_STRUCTURE_UPDATED", "SalaryStructure", structureId, { status: input.status });
  });
  return getSalaryStructure(scope, structureId);
}
