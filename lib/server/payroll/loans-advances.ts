// Staff Loans / Advances (Production Payroll checkpoint) — real, PostgreSQL-
// backed. One shared model (StaffFinancialAdvance) with a `type` discriminator
// (LOAN/ADVANCE) — see the schema doc comment for the full V1 policy. No
// interest/EMI engine, no automatic eligibility scoring, no automatic payroll
// deduction (manual repayment recording only), no real bank integration —
// "disbursed"/"repaid" always means a payroll manager manually recorded that
// money moved, never a real transfer.
//
// Lifecycle: PENDING -> APPROVED -> DISBURSED -> PARTIALLY_REPAID -> REPAID.
// PENDING -> REJECTED. APPROVED -> CANCELLED (only before disbursement).
// Every transition is a `SELECT ... FOR UPDATE` lock on the advance row
// followed by an explicit status check inside one transaction — the exact
// concurrency idiom lib/server/payroll/payments.ts and runs.ts already use —
// so two concurrent transitions (double approval, double disbursement,
// overlapping repayments) can never both succeed.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { ListMeta } from "@/lib/server/api/response";
import type {
  PayrollPaymentMethodDto,
  StaffFinancialAdvanceDetailDto,
  StaffFinancialAdvanceListItemDto,
  StaffFinancialAdvanceStatusDto,
} from "@/lib/api/contracts";
import { dec, money } from "@/lib/server/fees/money";
import { isBroadPayrollManager, resolvePayrollBranch } from "./access";
import { nextStaffFinancialAdvanceNumber } from "./loan-advance-number";
import { postStaffAdvanceDisbursementToAccounting, postStaffAdvanceRepaymentToAccounting } from "./loan-advance-posting";

export type AdvanceType = "LOAN" | "ADVANCE";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");
const parseDate = (d: string) => new Date(`${d}T00:00:00.000Z`);
const dateToUi = (d: Date) => d.toISOString().slice(0, 10);

const STATUS_TO_UI: Record<string, StaffFinancialAdvanceStatusDto> = {
  PENDING: "pending", APPROVED: "approved", REJECTED: "rejected", DISBURSED: "disbursed", PARTIALLY_REPAID: "partially_repaid", REPAID: "repaid", CANCELLED: "cancelled",
};
const STATUS_TO_DB: Record<string, string> = {
  pending: "PENDING", approved: "APPROVED", rejected: "REJECTED", disbursed: "DISBURSED", partially_repaid: "PARTIALLY_REPAID", repaid: "REPAID", cancelled: "CANCELLED",
};
const METHOD_TO_DB: Record<PayrollPaymentMethodDto, string> = { cash: "CASH", upi: "UPI", card: "CARD", bank_transfer: "BANK_TRANSFER", cheque: "CHEQUE", other: "OTHER" };
const METHOD_TO_UI: Record<string, PayrollPaymentMethodDto> = { CASH: "cash", UPI: "upi", CARD: "card", BANK_TRANSFER: "bank_transfer", CHEQUE: "cheque", OTHER: "other" };
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Nothing is owed until money has actually gone out the door. */
function outstandingOf(status: string, approvedAmount: Prisma.Decimal | null, repaidTotal: number): number {
  if (status === "PENDING" || status === "APPROVED" || status === "REJECTED" || status === "CANCELLED") return 0;
  return Math.max(0, round2(dec(approvedAmount) - repaidTotal));
}

const listSelect = {
  id: true, type: true, number: true, staffId: true, staffName: true, employeeCode: true,
  principalAmount: true, approvedAmount: true, status: true, requestedAt: true, createdAt: true,
  repayments: { select: { amount: true } },
} satisfies Prisma.StaffFinancialAdvanceSelect;
type ListRow = Prisma.StaffFinancialAdvanceGetPayload<{ select: typeof listSelect }>;

function listDto(r: ListRow): StaffFinancialAdvanceListItemDto {
  const repaidTotal = round2(r.repayments.reduce((s, x) => s + dec(x.amount), 0));
  return {
    id: r.id, type: r.type === "LOAN" ? "loan" : "advance", number: r.number, staffId: r.staffId, staffName: r.staffName, employeeCode: r.employeeCode,
    principalAmount: dec(r.principalAmount), approvedAmount: r.approvedAmount === null ? null : dec(r.approvedAmount),
    status: STATUS_TO_UI[r.status], outstanding: outstandingOf(r.status, r.approvedAmount, repaidTotal),
    requestedAt: r.requestedAt.toISOString(), createdAt: r.createdAt.toISOString(),
  };
}

export const listStaffFinancialAdvancesSchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "disbursed", "partially_repaid", "repaid", "cancelled"]).optional(),
  staffId: z.string().min(1).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export async function listStaffFinancialAdvances(scope: OrgScope, type: AdvanceType, raw: unknown): Promise<{ data: StaffFinancialAdvanceListItemDto[]; meta: ListMeta }> {
  const input = parseInput(listStaffFinancialAdvancesSchema, raw);
  const where: Prisma.StaffFinancialAdvanceWhereInput = {
    schoolId: scope.schoolId, type,
    ...(input.status ? { status: STATUS_TO_DB[input.status] as never } : {}),
    ...(input.staffId ? { staffId: input.staffId } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.staffFinancialAdvance.count({ where }),
    prisma.staffFinancialAdvance.findMany({ where, orderBy: { createdAt: "desc" }, skip: (input.page - 1) * input.pageSize, take: input.pageSize, select: listSelect }),
  ]);
  return { data: rows.map(listDto), meta: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.max(1, Math.ceil(total / input.pageSize)) } };
}

const detailSelect = {
  ...listSelect,
  purpose: true, notes: true,
  approvedAt: true, approvedByName: true,
  rejectedAt: true, rejectedByName: true, rejectionReason: true,
  cancelledAt: true, cancelledByName: true,
  disbursedAt: true, disbursedByName: true, disbursementMethod: true, disbursementReference: true,
  closedAt: true, createdByName: true,
  repayments: { select: { id: true, amount: true, paymentDate: true, method: true, reference: true, recordedByName: true, createdAt: true }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.StaffFinancialAdvanceSelect;
type DetailRow = Prisma.StaffFinancialAdvanceGetPayload<{ select: typeof detailSelect }>;

function detailDto(r: DetailRow): StaffFinancialAdvanceDetailDto {
  const repaidTotal = round2(r.repayments.reduce((s, x) => s + dec(x.amount), 0));
  return {
    ...listDto({ ...r, repayments: r.repayments.map((x) => ({ amount: x.amount })) }),
    purpose: r.purpose, notes: r.notes,
    approvedAt: r.approvedAt?.toISOString() ?? null, approvedByName: r.approvedByName,
    rejectedAt: r.rejectedAt?.toISOString() ?? null, rejectedByName: r.rejectedByName, rejectionReason: r.rejectionReason,
    cancelledAt: r.cancelledAt?.toISOString() ?? null, cancelledByName: r.cancelledByName,
    disbursedAt: r.disbursedAt?.toISOString() ?? null, disbursedByName: r.disbursedByName,
    disbursementMethod: r.disbursementMethod ? METHOD_TO_UI[r.disbursementMethod] : null, disbursementReference: r.disbursementReference,
    closedAt: r.closedAt?.toISOString() ?? null, createdByName: r.createdByName,
    repayments: r.repayments.map((x) => ({ id: x.id, amount: dec(x.amount), paymentDate: dateToUi(x.paymentDate), method: METHOD_TO_UI[x.method], reference: x.reference, recordedByName: x.recordedByName, createdAt: x.createdAt.toISOString() })),
    outstanding: outstandingOf(r.status, r.approvedAmount, repaidTotal),
  };
}

async function requireAdvanceInScope(scope: OrgScope, type: AdvanceType, id: string): Promise<DetailRow> {
  const row = await prisma.staffFinancialAdvance.findFirst({ where: { id, schoolId: scope.schoolId, type }, select: detailSelect });
  if (!row) throw new HttpError("STAFF_FINANCIAL_ADVANCE_NOT_FOUND", `${type === "LOAN" ? "Loan" : "Advance"} not found`);
  return row;
}

export async function getStaffFinancialAdvance(scope: OrgScope, type: AdvanceType, id: string): Promise<StaffFinancialAdvanceDetailDto> {
  return detailDto(await requireAdvanceInScope(scope, type, id));
}

export const createStaffFinancialAdvanceSchema = z.object({
  staffId: z.string().min(1),
  principalAmount: z.number().min(1).max(10_000_000),
  purpose: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(1000).optional(),
});

async function requireActiveStaffInScope(scope: OrgScope, staffId: string): Promise<{ id: string; employeeCode: string; firstName: string; lastName: string | null }> {
  const staff = await prisma.staff.findFirst({ where: { id: staffId, schoolId: scope.schoolId }, select: { id: true, employeeCode: true, firstName: true, lastName: true, status: true } });
  if (!staff) throw new HttpError("INVALID_STAFF_FOR_ADVANCE", "Staff not found");
  if (staff.status !== "ACTIVE") throw new HttpError("INVALID_STAFF_FOR_ADVANCE", "Only an active staff member can request a new loan or advance");
  return staff;
}

export async function createStaffFinancialAdvance(scope: OrgScope, type: AdvanceType, raw: unknown): Promise<StaffFinancialAdvanceDetailDto> {
  if (!(await isBroadPayrollManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input = parseInput(createStaffFinancialAdvanceSchema, raw);
  const staff = await requireActiveStaffInScope(scope, input.staffId);
  const branchId = await resolvePayrollBranch(scope);

  const created = await prisma.$transaction(async (tx) => {
    const number = await nextStaffFinancialAdvanceNumber(tx, scope.schoolId, type, new Date().getUTCFullYear());
    const row = await tx.staffFinancialAdvance.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, type, number,
        staffId: staff.id, staffName: [staff.firstName, staff.lastName].filter(Boolean).join(" "), employeeCode: staff.employeeCode,
        principalAmount: input.principalAmount, purpose: input.purpose, notes: input.notes,
        status: "PENDING", createdByUserId: scope.actor.id, createdByName: scope.actor.name,
      },
      select: { id: true },
    });
    await recordAudit(tx, scope, "STAFF_FINANCIAL_ADVANCE_CREATED", "StaffFinancialAdvance", row.id, { type, number, staffId: staff.id });
    return row;
  });
  return getStaffFinancialAdvance(scope, type, created.id);
}

export const updateStaffFinancialAdvanceSchema = z.object({
  principalAmount: z.number().min(1).max(10_000_000).optional(),
  purpose: z.string().trim().max(300).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export async function updateStaffFinancialAdvance(scope: OrgScope, type: AdvanceType, id: string, raw: unknown): Promise<StaffFinancialAdvanceDetailDto> {
  if (!(await isBroadPayrollManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input = parseInput(updateStaffFinancialAdvanceSchema, raw);
  const existing = await requireAdvanceInScope(scope, type, id);
  if (existing.status !== "PENDING") throw new HttpError("INVALID_STAFF_FINANCIAL_ADVANCE_TRANSITION", `Cannot edit a ${type === "LOAN" ? "loan" : "advance"} in "${existing.status.toLowerCase()}" status`);

  await prisma.$transaction(async (tx) => {
    await tx.staffFinancialAdvance.update({
      where: { id },
      data: { principalAmount: input.principalAmount, purpose: input.purpose === undefined ? undefined : input.purpose, notes: input.notes === undefined ? undefined : input.notes },
    });
    await recordAudit(tx, scope, "STAFF_FINANCIAL_ADVANCE_UPDATED", "StaffFinancialAdvance", id, {});
  });
  return getStaffFinancialAdvance(scope, type, id);
}

/** Shared row-lock + status-check helper for every lifecycle transition —
 * `SELECT ... FOR UPDATE` on the advance row, same pattern as Payroll's own
 * finalize/pay. Throws NOT_FOUND / INVALID_TRANSITION before the caller's
 * mutation runs, all inside the caller's own transaction. */
async function lockAdvanceForTransition(tx: Prisma.TransactionClient, scope: OrgScope, type: AdvanceType, id: string, expectedStatuses: string[]): Promise<{ id: string; status: string; approvedAmount: Prisma.Decimal | null; principalAmount: Prisma.Decimal }> {
  const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM staff_financial_advances WHERE id = ${id} AND "schoolId" = ${scope.schoolId} AND type = ${type}::"StaffFinancialAdvanceType" FOR UPDATE`;
  if (locked.length === 0) throw new HttpError("STAFF_FINANCIAL_ADVANCE_NOT_FOUND", `${type === "LOAN" ? "Loan" : "Advance"} not found`);
  const row = await tx.staffFinancialAdvance.findUniqueOrThrow({ where: { id }, select: { id: true, status: true, approvedAmount: true, principalAmount: true } });
  if (!expectedStatuses.includes(row.status)) throw new HttpError("INVALID_STAFF_FINANCIAL_ADVANCE_TRANSITION", `Cannot perform this action on a ${type === "LOAN" ? "loan" : "advance"} in "${row.status.toLowerCase()}" status`);
  return row;
}

export const approveStaffFinancialAdvanceSchema = z.object({ approvedAmount: z.number().min(1).max(10_000_000).optional() });

export async function approveStaffFinancialAdvance(scope: OrgScope, type: AdvanceType, id: string, raw: unknown): Promise<StaffFinancialAdvanceDetailDto> {
  if (!(await isBroadPayrollManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input = parseInput(approveStaffFinancialAdvanceSchema, raw);

  await prisma.$transaction(async (tx) => {
    const row = await lockAdvanceForTransition(tx, scope, type, id, ["PENDING"]);
    const approvedAmount = input.approvedAmount ?? dec(row.principalAmount);
    if (approvedAmount > dec(row.principalAmount)) throw new HttpError("INVALID_APPROVED_AMOUNT", "Approved amount cannot exceed the requested principal amount");
    await tx.staffFinancialAdvance.update({ where: { id }, data: { status: "APPROVED", approvedAmount, approvedByUserId: scope.actor.id, approvedByName: scope.actor.name, approvedAt: new Date() } });
    await recordAudit(tx, scope, "STAFF_FINANCIAL_ADVANCE_APPROVED", "StaffFinancialAdvance", id, { approvedAmount });
  });
  return getStaffFinancialAdvance(scope, type, id);
}

export const rejectStaffFinancialAdvanceSchema = z.object({ reason: z.string().trim().min(1).max(500) });

export async function rejectStaffFinancialAdvance(scope: OrgScope, type: AdvanceType, id: string, raw: unknown): Promise<StaffFinancialAdvanceDetailDto> {
  if (!(await isBroadPayrollManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input = parseInput(rejectStaffFinancialAdvanceSchema, raw);

  await prisma.$transaction(async (tx) => {
    await lockAdvanceForTransition(tx, scope, type, id, ["PENDING"]);
    await tx.staffFinancialAdvance.update({ where: { id }, data: { status: "REJECTED", rejectedByUserId: scope.actor.id, rejectedByName: scope.actor.name, rejectedAt: new Date(), rejectionReason: input.reason } });
    await recordAudit(tx, scope, "STAFF_FINANCIAL_ADVANCE_REJECTED", "StaffFinancialAdvance", id, { reason: input.reason });
  });
  return getStaffFinancialAdvance(scope, type, id);
}

export async function cancelStaffFinancialAdvance(scope: OrgScope, type: AdvanceType, id: string): Promise<StaffFinancialAdvanceDetailDto> {
  if (!(await isBroadPayrollManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");

  await prisma.$transaction(async (tx) => {
    await lockAdvanceForTransition(tx, scope, type, id, ["APPROVED"]);
    await tx.staffFinancialAdvance.update({ where: { id }, data: { status: "CANCELLED", cancelledByUserId: scope.actor.id, cancelledByName: scope.actor.name, cancelledAt: new Date() } });
    await recordAudit(tx, scope, "STAFF_FINANCIAL_ADVANCE_CANCELLED", "StaffFinancialAdvance", id, {});
  });
  return getStaffFinancialAdvance(scope, type, id);
}

export const disburseStaffFinancialAdvanceSchema = z.object({ disbursementDate: dateStr, method: z.enum(["cash", "upi", "card", "bank_transfer", "cheque", "other"]), reference: z.string().trim().max(120).optional() });

export async function disburseStaffFinancialAdvance(scope: OrgScope, type: AdvanceType, id: string, raw: unknown): Promise<StaffFinancialAdvanceDetailDto> {
  if (!(await isBroadPayrollManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input = parseInput(disburseStaffFinancialAdvanceSchema, raw);
  const disbursementDate = parseDate(input.disbursementDate);

  await prisma.$transaction(async (tx) => {
    const row = await lockAdvanceForTransition(tx, scope, type, id, ["APPROVED"]);
    await tx.staffFinancialAdvance.update({
      where: { id },
      data: { status: "DISBURSED", disbursedByUserId: scope.actor.id, disbursedByName: scope.actor.name, disbursedAt: new Date(), disbursementMethod: METHOD_TO_DB[input.method] as never, disbursementReference: input.reference ?? null },
    });
    await recordAudit(tx, scope, "STAFF_FINANCIAL_ADVANCE_DISBURSED", "StaffFinancialAdvance", id, { amount: dec(row.approvedAmount) });
    await postStaffAdvanceDisbursementToAccounting(tx, scope, { id, type, amount: row.approvedAmount ?? money(0), disbursementDate });
  });
  return getStaffFinancialAdvance(scope, type, id);
}

export const recordStaffFinancialAdvanceRepaymentSchema = z.object({ amount: z.number().min(0.01).max(10_000_000), paymentDate: dateStr, method: z.enum(["cash", "upi", "card", "bank_transfer", "cheque", "other"]), reference: z.string().trim().max(120).optional() });

export async function recordStaffFinancialAdvanceRepayment(scope: OrgScope, type: AdvanceType, id: string, raw: unknown): Promise<StaffFinancialAdvanceDetailDto> {
  if (!(await isBroadPayrollManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input = parseInput(recordStaffFinancialAdvanceRepaymentSchema, raw);
  const paymentDate = parseDate(input.paymentDate);

  await prisma.$transaction(async (tx) => {
    const row = await lockAdvanceForTransition(tx, scope, type, id, ["DISBURSED", "PARTIALLY_REPAID"]);
    // Recompute the sum of ALREADY-recorded repayments inside the same locked
    // transaction — the FOR UPDATE lock above serializes concurrent repayment
    // attempts against this row, so this read-then-check-then-write can never
    // combine with another to overpay. Pure Prisma.Decimal arithmetic
    // throughout — no JS float authority on the safety-critical comparison.
    const existingRepayments = await tx.staffFinancialAdvanceRepayment.aggregate({ where: { advanceId: id }, _sum: { amount: true } });
    const repaidSoFar = existingRepayments._sum.amount ?? new Prisma.Decimal(0);
    const approved = row.approvedAmount ?? new Prisma.Decimal(0);
    const outstanding = approved.minus(repaidSoFar);
    const amount = new Prisma.Decimal(input.amount);
    if (amount.greaterThan(outstanding)) throw new HttpError("REPAYMENT_EXCEEDS_OUTSTANDING", `Repayment of ${input.amount} exceeds the outstanding balance of ${dec(outstanding)}`);

    const repayment = await tx.staffFinancialAdvanceRepayment.create({
      data: { advanceId: id, amount: input.amount, paymentDate, method: METHOD_TO_DB[input.method] as never, reference: input.reference ?? null, recordedByUserId: scope.actor.id, recordedByName: scope.actor.name },
    });
    const fullyRepaid = outstanding.minus(amount).lessThanOrEqualTo(0);
    await tx.staffFinancialAdvance.update({ where: { id }, data: { status: fullyRepaid ? "REPAID" : "PARTIALLY_REPAID", closedAt: fullyRepaid ? new Date() : null } });
    await recordAudit(tx, scope, "STAFF_FINANCIAL_ADVANCE_REPAYMENT_RECORDED", "StaffFinancialAdvance", id, { amount: input.amount, fullyRepaid });

    await postStaffAdvanceRepaymentToAccounting(tx, scope, { id, type }, { id: repayment.id, amount: repayment.amount, paymentDate });
  });
  return getStaffFinancialAdvance(scope, type, id);
}
