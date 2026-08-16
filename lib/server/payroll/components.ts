// Salary Components (Phase 9H) — real, PostgreSQL-backed reusable
// earning/deduction line definitions. Archival (not delete) is the only
// lifecycle: an archived component's finalized PayrollRunItemComponent
// snapshots (componentName/type) remain readable and unaffected — see the
// schema doc comment.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { SalaryComponentDto, SalaryComponentStatusDto, SalaryComponentTypeDto } from "@/lib/api/contracts";
import { isBroadPayrollManager } from "./access";

const TYPE_TO_DB: Record<SalaryComponentTypeDto, string> = { earning: "EARNING", deduction: "DEDUCTION" };
const CALC_TO_DB: Record<"fixed" | "percentage", string> = { fixed: "FIXED", percentage: "PERCENTAGE" };

function toDto(c: { id: string; code: string; name: string; type: string; calcType: string; description: string | null; status: string }): SalaryComponentDto {
  return {
    id: c.id, code: c.code, name: c.name, type: c.type === "EARNING" ? "earning" : "deduction",
    calcType: c.calcType === "FIXED" ? "fixed" : "percentage", description: c.description,
    status: c.status === "ACTIVE" ? "active" : "archived",
  };
}

export async function listSalaryComponents(scope: OrgScope, params: { status?: SalaryComponentStatusDto } = {}): Promise<SalaryComponentDto[]> {
  const rows = await prisma.salaryComponent.findMany({
    where: { schoolId: scope.schoolId, ...(params.status ? { status: params.status.toUpperCase() as never } : {}) },
    orderBy: { code: "asc" },
  });
  return rows.map(toDto);
}

export const createSalaryComponentSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(80),
  type: z.enum(["earning", "deduction"]),
  calcType: z.enum(["fixed", "percentage"]),
  description: z.string().trim().max(500).optional(),
});

export async function createSalaryComponent(scope: OrgScope, raw: unknown): Promise<SalaryComponentDto> {
  if (!(await isBroadPayrollManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input = parseInput(createSalaryComponentSchema, raw);
  const clash = await prisma.salaryComponent.findFirst({ where: { schoolId: scope.schoolId, code: { equals: input.code, mode: "insensitive" } }, select: { id: true } });
  if (clash) throw new HttpError("SALARY_COMPONENT_CODE_EXISTS", "A salary component with this code already exists");
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.salaryComponent.create({
      data: { tenantId: scope.tenantId, schoolId: scope.schoolId, code: input.code, name: input.name, type: TYPE_TO_DB[input.type] as never, calcType: CALC_TO_DB[input.calcType] as never, description: input.description ?? null },
    });
    await recordAudit(tx, scope, "SALARY_COMPONENT_CREATED", "SalaryComponent", row.id, { code: row.code, name: row.name });
    return row;
  });
  return toDto(created);
}

export const updateSalaryComponentSchema = z.object({ name: z.string().trim().min(1).max(80).optional(), description: z.string().trim().max(500).nullable().optional(), status: z.enum(["active", "archived"]).optional() });

export async function updateSalaryComponent(scope: OrgScope, componentId: string, raw: unknown): Promise<SalaryComponentDto> {
  if (!(await isBroadPayrollManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input = parseInput(updateSalaryComponentSchema, raw);
  const existing = await prisma.salaryComponent.findFirst({ where: { id: componentId, schoolId: scope.schoolId }, select: { id: true } });
  if (!existing) throw new HttpError("SALARY_COMPONENT_NOT_FOUND", "Salary component not found");
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.salaryComponent.update({
      where: { id: componentId },
      data: { name: input.name, description: input.description === undefined ? undefined : input.description, status: input.status ? (input.status === "active" ? "ACTIVE" : "ARCHIVED") : undefined },
    });
    await recordAudit(tx, scope, "SALARY_COMPONENT_UPDATED", "SalaryComponent", componentId);
    return row;
  });
  return toDto(updated);
}
