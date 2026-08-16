// Staff Salary Assignments (Phase 9H) — real, PostgreSQL-backed, effective-
// dated. A salary change is always a NEW row (with the old one's
// effectiveTo set) — never a mutation of history. Overlap prevention locks
// the Staff row (`SELECT ... FOR UPDATE`) before checking for an existing
// overlapping assignment, exactly mirroring lib/server/leave/service.ts's
// leave-overlap check — two concurrent requests for the SAME staff member
// serialize on that lock and can never both pass the overlap check.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { StaffSalaryAssignmentDto } from "@/lib/api/contracts";
import { isBroadPayrollManager, resolvePayrollBranch } from "./access";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");
const parseDate = (d: string) => new Date(`${d}T00:00:00.000Z`);
const dateToUi = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

function displayName(s: { firstName: string; lastName: string | null; displayName: string | null }) {
  return s.displayName ?? [s.firstName, s.lastName].filter(Boolean).join(" ");
}

const selectDetail = {
  id: true, staffId: true, salaryStructureId: true, effectiveFrom: true, effectiveTo: true, createdByName: true, createdAt: true,
  staff: { select: { employeeCode: true, firstName: true, lastName: true, displayName: true } },
  salaryStructure: { select: { name: true } },
} satisfies Prisma.StaffSalaryAssignmentSelect;

function toDto(a: Prisma.StaffSalaryAssignmentGetPayload<{ select: typeof selectDetail }>): StaffSalaryAssignmentDto {
  return {
    id: a.id, staffId: a.staffId, employeeCode: a.staff.employeeCode, staffName: displayName(a.staff),
    salaryStructureId: a.salaryStructureId, salaryStructureName: a.salaryStructure.name,
    effectiveFrom: dateToUi(a.effectiveFrom)!, effectiveTo: dateToUi(a.effectiveTo), createdByName: a.createdByName, createdAt: a.createdAt.toISOString(),
  };
}

export async function listStaffSalaryAssignments(scope: OrgScope, params: { staffId?: string } = {}): Promise<StaffSalaryAssignmentDto[]> {
  const rows = await prisma.staffSalaryAssignment.findMany({
    where: { schoolId: scope.schoolId, ...(params.staffId ? { staffId: params.staffId } : {}) },
    orderBy: [{ staffId: "asc" }, { effectiveFrom: "desc" }],
    select: selectDetail,
  });
  return rows.map(toDto);
}

export const createStaffSalaryAssignmentSchema = z.object({ staffId: z.string().min(1), salaryStructureId: z.string().min(1), effectiveFrom: dateStr, effectiveTo: dateStr.optional() });

export async function createStaffSalaryAssignment(scope: OrgScope, raw: unknown): Promise<StaffSalaryAssignmentDto> {
  if (!(await isBroadPayrollManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input = parseInput(createStaffSalaryAssignmentSchema, raw);
  if (input.effectiveTo && parseDate(input.effectiveTo) < parseDate(input.effectiveFrom)) throw new HttpError("VALIDATION_ERROR", "effectiveTo cannot be before effectiveFrom");

  const staff = await prisma.staff.findFirst({ where: { id: input.staffId, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true, branchId: true } });
  if (!staff) throw new HttpError("NOT_FOUND", "Staff member not found or not active");
  const structure = await prisma.salaryStructure.findFirst({ where: { id: input.salaryStructureId, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (!structure) throw new HttpError("SALARY_STRUCTURE_NOT_FOUND", "Salary structure not found or archived");

  const branchId = await resolvePayrollBranch(scope);
  const from = parseDate(input.effectiveFrom);
  const to = input.effectiveTo ? parseDate(input.effectiveTo) : null;

  const created = await prisma.$transaction(async (tx) => {
    // Serialize every concurrent request for THIS staff member on their row lock.
    await tx.$queryRaw`SELECT id FROM staff WHERE id = ${input.staffId} FOR UPDATE`;
    const overlap = await tx.staffSalaryAssignment.findFirst({
      where: { staffId: input.staffId, effectiveFrom: { lte: to ?? new Date("9999-12-31") }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: from } }] },
      select: { id: true },
    });
    if (overlap) throw new HttpError("SALARY_ASSIGNMENT_OVERLAP", "This staff member already has a salary assignment overlapping these dates");

    const row = await tx.staffSalaryAssignment.create({
      data: { tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, staffId: input.staffId, salaryStructureId: input.salaryStructureId, effectiveFrom: from, effectiveTo: to, createdByUserId: scope.actor.id, createdByName: scope.actor.name },
      select: { id: true },
    });
    await recordAudit(tx, scope, "STAFF_SALARY_ASSIGNED", "StaffSalaryAssignment", row.id, { staffId: input.staffId, salaryStructureId: input.salaryStructureId });
    return row;
  });
  const full = await prisma.staffSalaryAssignment.findUniqueOrThrow({ where: { id: created.id }, select: selectDetail });
  return toDto(full);
}

/** Resolve the assignment effective for a given date (the last day of a
 * payroll period, per the Phase 9H policy documented on the schema). */
export async function resolveEffectiveAssignment(schoolId: string, staffId: string, asOf: Date) {
  return prisma.staffSalaryAssignment.findFirst({
    where: { schoolId, staffId, effectiveFrom: { lte: asOf }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }] },
    orderBy: { effectiveFrom: "desc" },
    select: { id: true, salaryStructureId: true },
  });
}
