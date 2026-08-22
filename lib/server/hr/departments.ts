// HR Core — Department master data (Phase 9P). Staff.id remains the sole
// canonical employee identity; this is an attribute lookup, never a parallel
// employee model. Archived (never hard-deleted) when referenced by Staff —
// historical Payroll/Attendance/Leave/TeachingAssignment rows never change
// when a department is renamed or archived.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { DepartmentDto } from "@/lib/api/contracts";

type Row = {
  id: string; code: string; name: string; description: string | null; headStaffId: string | null; status: string;
  createdAt: Date; updatedAt: Date;
  headStaff: { firstName: string; lastName: string | null; displayName: string | null } | null;
  _count: { staff: number };
};

const select = {
  id: true, code: true, name: true, description: true, headStaffId: true, status: true, createdAt: true, updatedAt: true,
  headStaff: { select: { firstName: true, lastName: true, displayName: true } },
  _count: { select: { staff: true } },
} satisfies Prisma.DepartmentSelect;

function headName(h: { firstName: string; lastName: string | null; displayName: string | null } | null): string | null {
  if (!h) return null;
  return h.displayName?.trim() || `${h.firstName} ${h.lastName ?? ""}`.trim();
}

function dto(d: Row): DepartmentDto {
  return {
    id: d.id, code: d.code, name: d.name, description: d.description,
    headStaffId: d.headStaffId, headStaffName: headName(d.headStaff),
    status: d.status.toLowerCase() as DepartmentDto["status"], staffCount: d._count.staff,
    createdAt: d.createdAt.toISOString(), updatedAt: d.updatedAt.toISOString(),
  };
}

export async function listDepartments(scope: OrgScope, params: { status?: string; search?: string } = {}): Promise<DepartmentDto[]> {
  const where: Prisma.DepartmentWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.status) where.status = params.status.toUpperCase() as never;
  if (params.search?.trim()) {
    const q = params.search.trim();
    where.OR = [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }];
  }
  const rows = await prisma.department.findMany({ where, select, orderBy: { name: "asc" } });
  return rows.map(dto);
}

async function requireDepartmentRow(scope: OrgScope, departmentId: string): Promise<Row> {
  const row = await prisma.department.findFirst({ where: { id: departmentId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select });
  if (!row) throw new HttpError("HR_DEPARTMENT_NOT_FOUND", "Department not found");
  return row;
}

export async function getDepartment(scope: OrgScope, departmentId: string): Promise<DepartmentDto> {
  return dto(await requireDepartmentRow(scope, departmentId));
}

async function resolveBranch(scope: OrgScope): Promise<string> {
  if (scope.branchId) return scope.branchId;
  const active = await prisma.branch.findMany({ where: { schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (active.length === 1) return active[0].id;
  throw new HttpError("INVALID_BRANCH", "Select a branch for this department");
}

async function validateHeadStaff(scope: OrgScope, headStaffId: string): Promise<void> {
  const staff = await prisma.staff.findFirst({ where: { id: headStaffId, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (!staff) throw new HttpError("VALIDATION_ERROR", "Department head must be a real, active staff member in this school");
}

export const createDepartmentSchema = z.object({
  code: z.string().trim().min(1).max(24),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  headStaffId: z.string().min(1).optional(),
});

export async function createDepartment(scope: OrgScope, raw: unknown): Promise<DepartmentDto> {
  const input = parseInput(createDepartmentSchema, raw);
  const branchId = await resolveBranch(scope);
  if (input.headStaffId) await validateHeadStaff(scope, input.headStaffId);
  let row;
  try {
    row = await prisma.department.create({
      data: { tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, code: input.code, name: input.name, description: input.description, headStaffId: input.headStaffId },
      select,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError("HR_DEPARTMENT_CODE_EXISTS", "A department with this code already exists");
    throw e;
  }
  await recordAudit(prisma, scope, "HR_DEPARTMENT_CREATED", "Department", row.id, { code: row.code, name: row.name });
  return dto(row);
}

export const updateDepartmentSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  headStaffId: z.string().nullable().optional(),
});

export async function updateDepartment(scope: OrgScope, departmentId: string, raw: unknown): Promise<DepartmentDto> {
  const input = parseInput(updateDepartmentSchema, raw);
  await requireDepartmentRow(scope, departmentId);
  if (input.headStaffId) await validateHeadStaff(scope, input.headStaffId);
  const row = await prisma.department.update({
    where: { id: departmentId },
    data: { name: input.name, description: input.description, headStaffId: input.headStaffId },
    select,
  });
  await recordAudit(prisma, scope, "HR_DEPARTMENT_UPDATED", "Department", departmentId, input);
  return dto(row);
}

export async function setDepartmentStatus(scope: OrgScope, departmentId: string, status: "active" | "archived"): Promise<DepartmentDto> {
  await requireDepartmentRow(scope, departmentId);
  const row = await prisma.department.update({ where: { id: departmentId }, data: { status: status.toUpperCase() as never }, select });
  await recordAudit(prisma, scope, status === "archived" ? "HR_DEPARTMENT_ARCHIVED" : "HR_DEPARTMENT_UPDATED", "Department", departmentId, { status });
  return dto(row);
}
