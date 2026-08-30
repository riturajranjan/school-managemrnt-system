// Production migration (Phase B, HR Sub-batch 2) — Employment Contracts. Real
// Staff relationship (Staff.id is the sole employee identity, same precedent
// as Department/Designation) — never a parallel employee model. Multiple
// contracts per staff member are allowed (employment history); there is no
// "current contract" pointer — callers derive it from status/dates.
//
// compensationNote is confidential: a caller who holds only hr.viewOwn (self-
// service) never receives it, regardless of whose contract they're reading —
// real compensation of record lives in Payroll's SalaryStructure/
// StaffSalaryAssignment, this is a negotiated-terms note, not a second source
// of truth for pay.
import { Prisma } from "@/lib/generated/prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { serverToday } from "@/lib/server/attendance/service";
import type { OrgScope } from "@/lib/server/api/scope";
import type { ContractDto, ContractStatusDto, ContractTypeDto } from "@/lib/api/contracts";

const TYPE_TO_DTO: Record<string, ContractTypeDto> = {
  PERMANENT: "permanent",
  FIXED_TERM: "fixed-term",
  PROBATION: "probation",
  TEMPORARY: "temporary",
  PART_TIME: "part-time",
  CONSULTANT: "consultant",
  VISITING_FACULTY: "visiting-faculty",
};
const DTO_TO_TYPE = Object.fromEntries(Object.entries(TYPE_TO_DTO).map(([k, v]) => [v, k])) as Record<ContractTypeDto, string>;
const CONTRACT_TYPE_VALUES = Object.keys(DTO_TO_TYPE) as [ContractTypeDto, ...ContractTypeDto[]];

const STATUS_TO_DTO: Record<string, ContractStatusDto> = {
  DRAFT: "draft",
  ACTIVE: "active",
  RENEWAL_PENDING: "renewal-pending",
  EXPIRED: "expired",
  TERMINATED: "terminated",
  ARCHIVED: "archived",
};
const DTO_TO_STATUS = Object.fromEntries(Object.entries(STATUS_TO_DTO).map(([k, v]) => [v, k])) as Record<ContractStatusDto, string>;
const CONTRACT_STATUS_VALUES = Object.keys(DTO_TO_STATUS) as [ContractStatusDto, ...ContractStatusDto[]];

type Row = {
  id: string;
  type: string;
  startDate: Date;
  endDate: Date | null;
  probationMonths: number | null;
  noticePeriodDays: number | null;
  workHoursPerWeek: number | null;
  compensationNote: string | null;
  terms: string | null;
  status: string;
  createdByName: string | null;
  updatedByName: string | null;
  createdAt: Date;
  updatedAt: Date;
  staffId: string;
  staff: { employeeCode: string; firstName: string; lastName: string | null; displayName: string | null };
};

const select = {
  id: true, type: true, startDate: true, endDate: true, probationMonths: true, noticePeriodDays: true,
  workHoursPerWeek: true, compensationNote: true, terms: true, status: true, createdByName: true, updatedByName: true,
  createdAt: true, updatedAt: true, staffId: true,
  staff: { select: { employeeCode: true, firstName: true, lastName: true, displayName: true } },
} satisfies Prisma.ContractSelect;

function staffName(s: { firstName: string; lastName: string | null; displayName: string | null }): string {
  return s.displayName?.trim() || `${s.firstName} ${s.lastName ?? ""}`.trim();
}

function toDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isExpiringSoon(row: Pick<Row, "status" | "endDate">, today: string): boolean {
  if (row.status !== "ACTIVE" && row.status !== "RENEWAL_PENDING") return false;
  if (!row.endDate) return false;
  const end = toDate(row.endDate);
  if (end < today) return false;
  const in30 = new Date(`${today}T00:00:00Z`);
  in30.setUTCDate(in30.getUTCDate() + 30);
  return end <= toDate(in30);
}

/** `redactConfidential: true` nulls compensationNote — used for every hr.viewOwn-only read. */
function dto(row: Row, today: string, redactConfidential: boolean): ContractDto {
  return {
    id: row.id,
    staffId: row.staffId,
    staffName: staffName(row.staff),
    employeeCode: row.staff.employeeCode,
    type: TYPE_TO_DTO[row.type] ?? "permanent",
    startDate: toDate(row.startDate),
    endDate: row.endDate ? toDate(row.endDate) : null,
    probationMonths: row.probationMonths,
    noticePeriodDays: row.noticePeriodDays,
    workHoursPerWeek: row.workHoursPerWeek,
    compensationNote: redactConfidential ? null : row.compensationNote,
    terms: row.terms,
    status: STATUS_TO_DTO[row.status] ?? "draft",
    isExpiringSoon: isExpiringSoon(row, today),
    createdByName: row.createdByName,
    updatedByName: row.updatedByName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function requireStaffRow(scope: OrgScope, staffId: string): Promise<{ id: string; branchId: string }> {
  const staff = await prisma.staff.findFirst({
    where: { id: staffId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    select: { id: true, branchId: true },
  });
  if (!staff) throw new HttpError("VALIDATION_ERROR", "Staff member not found in this school");
  return staff;
}

async function requireContractRow(scope: OrgScope, contractId: string): Promise<Row> {
  const row = await prisma.contract.findFirst({
    where: { id: contractId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) },
    select,
  });
  if (!row) throw new HttpError("CONTRACT_NOT_FOUND", "Contract not found");
  return row;
}

export async function listContracts(scope: OrgScope, params: { staffId?: string; status?: ContractStatusDto } = {}): Promise<ContractDto[]> {
  const where: Prisma.ContractWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.staffId) where.staffId = params.staffId;
  if (params.status) where.status = DTO_TO_STATUS[params.status] as never;
  const today = serverToday();
  const rows = await prisma.contract.findMany({ where, select, orderBy: { startDate: "desc" } });
  return rows.map((r) => dto(r, today, false));
}

export async function getContract(scope: OrgScope, contractId: string): Promise<ContractDto> {
  const row = await requireContractRow(scope, contractId);
  return dto(row, serverToday(), false);
}

/** Own-record reads (Employee Self Service) — compensationNote always redacted. */
export async function listContractsForStaff(scope: OrgScope, staffId: string): Promise<ContractDto[]> {
  const rows = await prisma.contract.findMany({ where: { schoolId: scope.schoolId, staffId }, select, orderBy: { startDate: "desc" } });
  const today = serverToday();
  return rows.map((r) => dto(r, today, true));
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const createContractSchema = z
  .object({
    staffId: z.string().min(1),
    type: z.enum(CONTRACT_TYPE_VALUES),
    startDate: dateSchema,
    endDate: dateSchema.optional(),
    probationMonths: z.number().int().min(0).max(36).optional(),
    noticePeriodDays: z.number().int().min(0).max(365).optional(),
    workHoursPerWeek: z.number().int().min(1).max(168).optional(),
    compensationNote: z.string().trim().max(500).optional(),
    terms: z.string().trim().max(2000).optional(),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, { message: "End date must be on or after the start date", path: ["endDate"] });

export async function createContract(scope: OrgScope, raw: unknown): Promise<ContractDto> {
  const input = parseInput(createContractSchema, raw);
  const staff = await requireStaffRow(scope, input.staffId);
  const row = await prisma.contract.create({
    data: {
      tenantId: scope.tenantId,
      schoolId: scope.schoolId,
      branchId: staff.branchId,
      staffId: staff.id,
      type: DTO_TO_TYPE[input.type] as never,
      startDate: new Date(`${input.startDate}T00:00:00Z`),
      endDate: input.endDate ? new Date(`${input.endDate}T00:00:00Z`) : null,
      probationMonths: input.probationMonths,
      noticePeriodDays: input.noticePeriodDays,
      workHoursPerWeek: input.workHoursPerWeek,
      compensationNote: input.compensationNote,
      terms: input.terms,
      createdByUserId: scope.actor.id,
      createdByName: scope.actor.name,
    },
    select,
  });
  await recordAudit(prisma, scope, "CONTRACT_CREATED", "Contract", row.id, { staffId: staff.id, type: input.type });
  return dto(row, serverToday(), false);
}

export const updateContractSchema = z
  .object({
    type: z.enum(CONTRACT_TYPE_VALUES).optional(),
    startDate: dateSchema.optional(),
    endDate: dateSchema.nullable().optional(),
    probationMonths: z.number().int().min(0).max(36).nullable().optional(),
    noticePeriodDays: z.number().int().min(0).max(365).nullable().optional(),
    workHoursPerWeek: z.number().int().min(1).max(168).nullable().optional(),
    compensationNote: z.string().trim().max(500).nullable().optional(),
    terms: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((v) => !v.startDate || !v.endDate || v.endDate >= v.startDate, { message: "End date must be on or after the start date", path: ["endDate"] });

export async function updateContract(scope: OrgScope, contractId: string, raw: unknown): Promise<ContractDto> {
  const input = parseInput(updateContractSchema, raw);
  await requireContractRow(scope, contractId);
  const row = await prisma.contract.update({
    where: { id: contractId },
    data: {
      type: input.type ? (DTO_TO_TYPE[input.type] as never) : undefined,
      startDate: input.startDate ? new Date(`${input.startDate}T00:00:00Z`) : undefined,
      endDate: input.endDate === undefined ? undefined : input.endDate ? new Date(`${input.endDate}T00:00:00Z`) : null,
      probationMonths: input.probationMonths,
      noticePeriodDays: input.noticePeriodDays,
      workHoursPerWeek: input.workHoursPerWeek,
      compensationNote: input.compensationNote,
      terms: input.terms,
      updatedByUserId: scope.actor.id,
      updatedByName: scope.actor.name,
    },
    select,
  });
  await recordAudit(prisma, scope, "CONTRACT_UPDATED", "Contract", contractId, input);
  return dto(row, serverToday(), false);
}

/** Status is a manual HR decision (activate/renewal-pending/terminate/expire), and
 * "archived" is the delete-equivalent — a contract is historical employment
 * record, never hard-deleted. */
export async function setContractStatus(scope: OrgScope, contractId: string, status: ContractStatusDto): Promise<ContractDto> {
  await requireContractRow(scope, contractId);
  const row = await prisma.contract.update({
    where: { id: contractId },
    data: { status: DTO_TO_STATUS[status] as never, updatedByUserId: scope.actor.id, updatedByName: scope.actor.name },
    select,
  });
  await recordAudit(prisma, scope, "CONTRACT_STATUS_CHANGED", "Contract", contractId, { status });
  return dto(row, serverToday(), false);
}

export { CONTRACT_STATUS_VALUES };
