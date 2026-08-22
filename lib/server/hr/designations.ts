// HR Core — Designation master data (Phase 9P). Optionally department-scoped
// (a designation need not belong to a department — e.g. "Principal"). When it
// is scoped, a Staff assigned that designation must belong to the same
// department (validated in lib/server/staff/service.ts). `level` is a plain
// optional display/sort order, never a promotion or hierarchy policy.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { DesignationDto } from "@/lib/api/contracts";

type Row = {
  id: string; code: string; name: string; description: string | null; departmentId: string | null; level: number | null; status: string;
  createdAt: Date; updatedAt: Date;
  department: { name: string } | null;
  _count: { staff: number };
};

const select = {
  id: true, code: true, name: true, description: true, departmentId: true, level: true, status: true, createdAt: true, updatedAt: true,
  department: { select: { name: true } },
  _count: { select: { staff: true } },
} satisfies Prisma.DesignationSelect;

function dto(d: Row): DesignationDto {
  return {
    id: d.id, code: d.code, name: d.name, description: d.description,
    departmentId: d.departmentId, departmentName: d.department?.name ?? null, level: d.level,
    status: d.status.toLowerCase() as DesignationDto["status"], staffCount: d._count.staff,
    createdAt: d.createdAt.toISOString(), updatedAt: d.updatedAt.toISOString(),
  };
}

export async function listDesignations(scope: OrgScope, params: { status?: string; departmentId?: string; search?: string } = {}): Promise<DesignationDto[]> {
  const where: Prisma.DesignationWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.status) where.status = params.status.toUpperCase() as never;
  if (params.departmentId) where.departmentId = params.departmentId;
  if (params.search?.trim()) {
    const q = params.search.trim();
    where.OR = [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }];
  }
  const rows = await prisma.designation.findMany({ where, select, orderBy: [{ level: "asc" }, { name: "asc" }] });
  return rows.map(dto);
}

async function requireDesignationRow(scope: OrgScope, designationId: string): Promise<Row> {
  const row = await prisma.designation.findFirst({ where: { id: designationId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select });
  if (!row) throw new HttpError("HR_DESIGNATION_NOT_FOUND", "Designation not found");
  return row;
}

export async function getDesignation(scope: OrgScope, designationId: string): Promise<DesignationDto> {
  return dto(await requireDesignationRow(scope, designationId));
}

async function resolveBranch(scope: OrgScope): Promise<string> {
  if (scope.branchId) return scope.branchId;
  const active = await prisma.branch.findMany({ where: { schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (active.length === 1) return active[0].id;
  throw new HttpError("INVALID_BRANCH", "Select a branch for this designation");
}

async function validateDepartment(scope: OrgScope, departmentId: string): Promise<void> {
  const dept = await prisma.department.findFirst({ where: { id: departmentId, schoolId: scope.schoolId }, select: { id: true } });
  if (!dept) throw new HttpError("INVALID_DEPARTMENT", "Department not found in this school");
}

export const createDesignationSchema = z.object({
  code: z.string().trim().min(1).max(24),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  departmentId: z.string().min(1).optional(),
  level: z.number().int().min(1).max(99).optional(),
});

export async function createDesignation(scope: OrgScope, raw: unknown): Promise<DesignationDto> {
  const input = parseInput(createDesignationSchema, raw);
  const branchId = await resolveBranch(scope);
  if (input.departmentId) await validateDepartment(scope, input.departmentId);
  let row;
  try {
    row = await prisma.designation.create({
      data: { tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, code: input.code, name: input.name, description: input.description, departmentId: input.departmentId, level: input.level },
      select,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError("HR_DESIGNATION_CODE_EXISTS", "A designation with this code already exists");
    throw e;
  }
  await recordAudit(prisma, scope, "HR_DESIGNATION_CREATED", "Designation", row.id, { code: row.code, name: row.name });
  return dto(row);
}

export const updateDesignationSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  departmentId: z.string().nullable().optional(),
  level: z.number().int().min(1).max(99).nullable().optional(),
});

export async function updateDesignation(scope: OrgScope, designationId: string, raw: unknown): Promise<DesignationDto> {
  const input = parseInput(updateDesignationSchema, raw);
  await requireDesignationRow(scope, designationId);
  if (input.departmentId) await validateDepartment(scope, input.departmentId);
  const row = await prisma.designation.update({
    where: { id: designationId },
    data: { name: input.name, description: input.description, departmentId: input.departmentId, level: input.level },
    select,
  });
  await recordAudit(prisma, scope, "HR_DESIGNATION_UPDATED", "Designation", designationId, input);
  return dto(row);
}

export async function setDesignationStatus(scope: OrgScope, designationId: string, status: "active" | "archived"): Promise<DesignationDto> {
  await requireDesignationRow(scope, designationId);
  const row = await prisma.designation.update({ where: { id: designationId }, data: { status: status.toUpperCase() as never }, select });
  await recordAudit(prisma, scope, status === "archived" ? "HR_DESIGNATION_ARCHIVED" : "HR_DESIGNATION_UPDATED", "Designation", designationId, { status });
  return dto(row);
}
