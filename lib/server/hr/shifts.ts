// Production migration (Phase B, HR Sub-batch 4) — Shifts. Relational
// ShiftAssignment (never an array of staff ids on Shift). Overlap prevention
// mirrors lib/server/payroll/assignments.ts's StaffSalaryAssignment exactly
// — a row lock on Staff serializes concurrent assignment requests for the
// same employee before the overlap check runs, so two concurrent requests
// can never both pass.
import { Prisma } from "@/lib/generated/prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import type { ListMeta } from "@/lib/server/api/response";
import { parseInput } from "@/lib/server/validation";
import type { OrgScope } from "@/lib/server/api/scope";
import type { AssignShiftRequest, MyShiftDto, ShiftAssignmentDto, ShiftDto, ShiftStatusDto } from "@/lib/api/contracts";

const STATUS_TO_DTO: Record<string, ShiftStatusDto> = { ACTIVE: "active", INACTIVE: "inactive" };
const DTO_TO_STATUS = Object.fromEntries(Object.entries(STATUS_TO_DTO).map(([k, v]) => [v, k])) as Record<ShiftStatusDto, string>;
export const SHIFT_STATUS_VALUES = Object.keys(DTO_TO_STATUS) as [ShiftStatusDto, ...ShiftStatusDto[]];

function toDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function staffName(s: { firstName: string; lastName: string | null; displayName: string | null }): string {
  return s.displayName?.trim() || `${s.firstName} ${s.lastName ?? ""}`.trim();
}

type ShiftRow = {
  id: string; name: string; startMinutes: number; endMinutes: number; breakMinutes: number | null; workingDays: string[];
  status: string; createdByName: string | null; updatedByName: string | null; createdAt: Date; updatedAt: Date; _count: { assignments: number };
};

const shiftSelect = {
  id: true, name: true, startMinutes: true, endMinutes: true, breakMinutes: true, workingDays: true, status: true,
  createdByName: true, updatedByName: true, createdAt: true, updatedAt: true, _count: { select: { assignments: true } },
} satisfies Prisma.ShiftSelect;

function shiftDto(row: ShiftRow): ShiftDto {
  return {
    id: row.id,
    name: row.name,
    startTime: toHHMM(row.startMinutes),
    endTime: toHHMM(row.endMinutes),
    startMinutes: row.startMinutes,
    endMinutes: row.endMinutes,
    breakMinutes: row.breakMinutes,
    workingDays: row.workingDays,
    status: (STATUS_TO_DTO[row.status] ?? "active") as ShiftStatusDto,
    assignedCount: row._count.assignments,
    createdByName: row.createdByName,
    updatedByName: row.updatedByName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function requireShiftRow(scope: OrgScope, shiftId: string): Promise<ShiftRow> {
  const row = await prisma.shift.findFirst({
    where: { id: shiftId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    select: shiftSelect,
  });
  if (!row) throw new HttpError("SHIFT_NOT_FOUND", "Shift not found");
  return row;
}

export const listShiftsSchema = z.object({
  status: z.enum(SHIFT_STATUS_VALUES).optional(),
  search: z.string().trim().max(200).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export async function listShifts(scope: OrgScope, raw: unknown = {}): Promise<{ data: ShiftDto[]; meta: ListMeta }> {
  const input = parseInput(listShiftsSchema, raw);
  const where: Prisma.ShiftWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (input.status) where.status = DTO_TO_STATUS[input.status] as never;
  if (input.search) where.name = { contains: input.search, mode: "insensitive" };
  const [total, rows] = await Promise.all([
    prisma.shift.count({ where }),
    prisma.shift.findMany({ where, select: shiftSelect, orderBy: { name: "asc" }, skip: (input.page - 1) * input.pageSize, take: input.pageSize }),
  ]);
  return { data: rows.map(shiftDto), meta: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.max(1, Math.ceil(total / input.pageSize)) } };
}

export async function getShift(scope: OrgScope, shiftId: string): Promise<ShiftDto> {
  return shiftDto(await requireShiftRow(scope, shiftId));
}

async function resolveBranch(scope: OrgScope): Promise<string> {
  if (scope.branchId) return scope.branchId;
  const active = await prisma.branch.findMany({ where: { schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (active.length === 1) return active[0].id;
  throw new HttpError("INVALID_BRANCH", "Select a branch for this shift");
}

const WEEKDAY_CODES = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

export const createShiftSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    startMinutes: z.number().int().min(0).max(1439),
    endMinutes: z.number().int().min(0).max(1439),
    breakMinutes: z.number().int().min(0).max(480).optional(),
    workingDays: z.array(z.enum(WEEKDAY_CODES)).optional(),
  })
  .refine((v) => v.endMinutes !== v.startMinutes, { message: "End time must differ from start time", path: ["endMinutes"] });

export async function createShift(scope: OrgScope, raw: unknown): Promise<ShiftDto> {
  const input = parseInput(createShiftSchema, raw);
  const branchId = await resolveBranch(scope);
  let row;
  try {
    row = await prisma.shift.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, name: input.name,
        startMinutes: input.startMinutes, endMinutes: input.endMinutes, breakMinutes: input.breakMinutes,
        workingDays: input.workingDays ?? [], createdByUserId: scope.actor.id, createdByName: scope.actor.name,
      },
      select: shiftSelect,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError("SHIFT_NAME_EXISTS", "A shift with this name already exists");
    throw e;
  }
  await recordAudit(prisma, scope, "SHIFT_CREATED", "Shift", row.id, { name: row.name });
  return shiftDto(row);
}

export const updateShiftSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    startMinutes: z.number().int().min(0).max(1439).optional(),
    endMinutes: z.number().int().min(0).max(1439).optional(),
    breakMinutes: z.number().int().min(0).max(480).nullable().optional(),
    workingDays: z.array(z.enum(WEEKDAY_CODES)).optional(),
  })
  .refine((v) => v.startMinutes === undefined || v.endMinutes === undefined || v.endMinutes !== v.startMinutes, { message: "End time must differ from start time", path: ["endMinutes"] });

export async function updateShift(scope: OrgScope, shiftId: string, raw: unknown): Promise<ShiftDto> {
  const input = parseInput(updateShiftSchema, raw);
  await requireShiftRow(scope, shiftId);
  let row;
  try {
    row = await prisma.shift.update({
      where: { id: shiftId },
      data: {
        name: input.name, startMinutes: input.startMinutes, endMinutes: input.endMinutes,
        breakMinutes: input.breakMinutes, workingDays: input.workingDays, updatedByUserId: scope.actor.id, updatedByName: scope.actor.name,
      },
      select: shiftSelect,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError("SHIFT_NAME_EXISTS", "A shift with this name already exists");
    throw e;
  }
  await recordAudit(prisma, scope, "SHIFT_UPDATED", "Shift", shiftId, input);
  return shiftDto(row);
}

export async function setShiftStatus(scope: OrgScope, shiftId: string, status: ShiftStatusDto): Promise<ShiftDto> {
  await requireShiftRow(scope, shiftId);
  const row = await prisma.shift.update({
    where: { id: shiftId },
    data: { status: DTO_TO_STATUS[status] as never, updatedByUserId: scope.actor.id, updatedByName: scope.actor.name },
    select: shiftSelect,
  });
  await recordAudit(prisma, scope, "SHIFT_STATUS_CHANGED", "Shift", shiftId, { status });
  return shiftDto(row);
}

// ── Assignments ──────────────────────────────────────────────────────────

type AssignmentRow = {
  id: string; shiftId: string; staffId: string; effectiveFrom: Date; effectiveUntil: Date | null;
  assignedByName: string | null; createdAt: Date;
  staff: { employeeCode: string; firstName: string; lastName: string | null; displayName: string | null };
};

const assignmentSelect = {
  id: true, shiftId: true, staffId: true, effectiveFrom: true, effectiveUntil: true, assignedByName: true, createdAt: true,
  staff: { select: { employeeCode: true, firstName: true, lastName: true, displayName: true } },
} satisfies Prisma.ShiftAssignmentSelect;

function assignmentDto(row: AssignmentRow): ShiftAssignmentDto {
  return {
    id: row.id,
    shiftId: row.shiftId,
    staffId: row.staffId,
    staffName: staffName(row.staff),
    employeeCode: row.staff.employeeCode,
    effectiveFrom: toDate(row.effectiveFrom),
    effectiveUntil: row.effectiveUntil ? toDate(row.effectiveUntil) : null,
    assignedByName: row.assignedByName,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listShiftAssignments(scope: OrgScope, shiftId: string): Promise<ShiftAssignmentDto[]> {
  await requireShiftRow(scope, shiftId);
  const rows = await prisma.shiftAssignment.findMany({ where: { shiftId }, select: assignmentSelect, orderBy: { effectiveFrom: "desc" } });
  return rows.map(assignmentDto);
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
export const assignShiftSchema = z
  .object({ staffId: z.string().min(1), effectiveFrom: dateSchema, effectiveUntil: dateSchema.optional() })
  .refine((v) => !v.effectiveUntil || v.effectiveUntil >= v.effectiveFrom, { message: "effectiveUntil cannot be before effectiveFrom", path: ["effectiveUntil"] });

export async function assignShift(scope: OrgScope, shiftId: string, raw: unknown): Promise<ShiftAssignmentDto> {
  const input: AssignShiftRequest = parseInput(assignShiftSchema, raw);
  const shift = await requireShiftRow(scope, shiftId);
  const staff = await prisma.staff.findFirst({
    where: { id: input.staffId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    select: { id: true, branchId: true },
  });
  if (!staff) throw new HttpError("VALIDATION_ERROR", "Staff member not found in this school");

  const from = new Date(`${input.effectiveFrom}T00:00:00Z`);
  const to = input.effectiveUntil ? new Date(`${input.effectiveUntil}T00:00:00Z`) : null;

  const created = await prisma.$transaction(async (tx) => {
    // Serialize every concurrent request for THIS staff member on their row lock.
    await tx.$queryRaw`SELECT id FROM staff WHERE id = ${staff.id} FOR UPDATE`;
    const overlap = await tx.shiftAssignment.findFirst({
      where: { staffId: staff.id, effectiveFrom: { lte: to ?? new Date("9999-12-31") }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: from } }] },
      select: { id: true },
    });
    if (overlap) throw new HttpError("SHIFT_ASSIGNMENT_OVERLAP", "This staff member already has a shift assignment overlapping these dates");

    const row = await tx.shiftAssignment.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: staff.branchId, shiftId: shift.id, staffId: staff.id,
        effectiveFrom: from, effectiveUntil: to, assignedByUserId: scope.actor.id, assignedByName: scope.actor.name,
      },
      select: { id: true },
    });
    await recordAudit(tx, scope, "SHIFT_ASSIGNED", "ShiftAssignment", row.id, { shiftId: shift.id, staffId: staff.id });
    return row;
  });

  return assignmentDto(await prisma.shiftAssignment.findUniqueOrThrow({ where: { id: created.id }, select: assignmentSelect }));
}

/** Own-record read (Employee Self Service) — the caller's currently-
 * effective shift assignment as of today, or null if unassigned. */
export async function getMyShift(scope: OrgScope, staffId: string): Promise<MyShiftDto> {
  const today = new Date().toISOString().slice(0, 10);
  const row = await prisma.shiftAssignment.findFirst({
    where: { schoolId: scope.schoolId, staffId, effectiveFrom: { lte: new Date(`${today}T00:00:00Z`) }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: new Date(`${today}T00:00:00Z`) } }] },
    orderBy: { effectiveFrom: "desc" },
    select: { effectiveFrom: true, effectiveUntil: true, shift: { select: { id: true, name: true, startMinutes: true, endMinutes: true, breakMinutes: true, workingDays: true } } },
  });
  if (!row) return null;
  return {
    shiftId: row.shift.id,
    name: row.shift.name,
    startTime: toHHMM(row.shift.startMinutes),
    endTime: toHHMM(row.shift.endMinutes),
    breakMinutes: row.shift.breakMinutes,
    workingDays: row.shift.workingDays,
    effectiveFrom: toDate(row.effectiveFrom),
    effectiveUntil: row.effectiveUntil ? toDate(row.effectiveUntil) : null,
  };
}
