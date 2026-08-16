// Payroll Runs (Phase 9H) — real, PostgreSQL-backed. Lifecycle:
// DRAFT -> CALCULATED -> FINALIZED -> PAID (PAID is driven by
// lib/server/payroll/payments.ts, not this file). Calculating replaces this
// run's PayrollRunItem/PayrollRunItemComponent rows (idempotent) until
// FINALIZED, whose "SELECT ... FOR UPDATE" lock on the PayrollRun row makes
// two concurrent finalize attempts serialize — the loser re-reads the
// already-FINALIZED status and is rejected. See the schema's Phase 9H
// section doc comment for the full policy (why NO attendance/leave-based
// deduction is calculated here).
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { PayrollRunDetailDto, PayrollRunItemDto, PayrollRunListItemDto, PayrollRunStatusDto } from "@/lib/api/contracts";
import { dec } from "@/lib/server/fees/money";
import { isBroadPayrollManager, resolvePayrollBranch } from "./access";
import { resolveEffectiveAssignment } from "./assignments";
import { resolveStructureComponents, summarizeLines } from "./calculation";

const STATUS_TO_UI: Record<string, PayrollRunStatusDto> = { DRAFT: "draft", CALCULATED: "calculated", FINALIZED: "finalized", PAID: "paid" };
const period = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;
function periodBounds(year: number, month: number): { start: Date; end: Date } {
  return { start: new Date(Date.UTC(year, month - 1, 1)), end: new Date(Date.UTC(year, month, 0)) };
}
function displayName(s: { firstName: string; lastName: string | null; displayName: string | null }) {
  return s.displayName ?? [s.firstName, s.lastName].filter(Boolean).join(" ");
}

const listSelect = {
  id: true, year: true, month: true, status: true, totalGross: true, totalDeductions: true, totalNet: true,
  calculatedAt: true, finalizedAt: true, paidAt: true, _count: { select: { items: true } },
} satisfies Prisma.PayrollRunSelect;

function listDto(r: Prisma.PayrollRunGetPayload<{ select: typeof listSelect }>): PayrollRunListItemDto {
  return {
    id: r.id, year: r.year, month: r.month, period: period(r.year, r.month), status: STATUS_TO_UI[r.status],
    staffCount: r._count.items, totalGross: dec(r.totalGross), totalDeductions: dec(r.totalDeductions), totalNet: dec(r.totalNet),
    calculatedAt: r.calculatedAt?.toISOString() ?? null, finalizedAt: r.finalizedAt?.toISOString() ?? null, paidAt: r.paidAt?.toISOString() ?? null,
  };
}

export async function listPayrollRuns(scope: OrgScope, params: { status?: PayrollRunStatusDto } = {}): Promise<PayrollRunListItemDto[]> {
  const rows = await prisma.payrollRun.findMany({
    where: { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}), ...(params.status ? { status: params.status.toUpperCase() as never } : {}) },
    orderBy: [{ year: "desc" }, { month: "desc" }],
    select: listSelect,
  });
  return rows.map(listDto);
}

async function requireRunInScope(scope: OrgScope, runId: string) {
  const row = await prisma.payrollRun.findFirst({ where: { id: runId, schoolId: scope.schoolId }, select: { id: true, year: true, month: true, branchId: true, status: true } });
  if (!row) throw new HttpError("PAYROLL_RUN_NOT_FOUND", "Payroll run not found");
  return row;
}

export async function getPayrollRun(scope: OrgScope, runId: string): Promise<PayrollRunDetailDto> {
  const run = await requireRunInScope(scope, runId);
  const r = await prisma.payrollRun.findUniqueOrThrow({ where: { id: runId }, select: listSelect });
  const items = await prisma.payrollRunItem.findMany({
    where: { payrollRunId: runId },
    orderBy: { staffName: "asc" },
    select: {
      id: true, staffId: true, employeeCode: true, staffName: true, salaryStructureId: true, salaryStructureName: true,
      grossEarnings: true, totalDeductions: true, netPay: true, presentDays: true, absentDays: true, lateDays: true, halfDays: true, onLeaveDays: true, notMarkedDays: true, paidLeaveDays: true, unpaidLeaveDays: true,
      components: { select: { id: true, componentId: true, componentName: true, type: true, amount: true, source: true, manualReason: true } },
    },
  });
  const itemDtos: PayrollRunItemDto[] = items.map((i) => ({
    id: i.id, staffId: i.staffId, employeeCode: i.employeeCode, staffName: i.staffName, salaryStructureId: i.salaryStructureId, salaryStructureName: i.salaryStructureName,
    grossEarnings: dec(i.grossEarnings), totalDeductions: dec(i.totalDeductions), netPay: dec(i.netPay),
    attendance: { present: i.presentDays, absent: i.absentDays, late: i.lateDays, halfDay: i.halfDays, onLeave: i.onLeaveDays, notMarked: i.notMarkedDays, paidLeave: i.paidLeaveDays, unpaidLeave: i.unpaidLeaveDays },
    components: i.components.map((c) => ({ id: c.id, componentId: c.componentId, componentName: c.componentName, type: c.type === "EARNING" ? "earning" : "deduction", amount: dec(c.amount), source: c.source === "MANUAL" ? "manual" : "structure", manualReason: c.manualReason })),
  }));

  const assignedStaffIds = new Set(items.map((i) => i.staffId));
  const activeStaff = await prisma.staff.findMany({ where: { schoolId: scope.schoolId, branchId: run.branchId, status: "ACTIVE" }, select: { id: true, employeeCode: true, firstName: true, lastName: true, displayName: true } });
  const staffWithoutAssignment = activeStaff.filter((s) => !assignedStaffIds.has(s.id)).map((s) => ({ staffId: s.id, employeeCode: s.employeeCode, staffName: displayName(s) }));

  return { ...listDto(r), items: itemDtos, staffWithoutAssignment };
}

export const createPayrollRunSchema = z.object({ year: z.number().int().min(2000).max(2100), month: z.number().int().min(1).max(12) });

export async function createPayrollRun(scope: OrgScope, raw: unknown): Promise<PayrollRunListItemDto> {
  if (!(await isBroadPayrollManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input = parseInput(createPayrollRunSchema, raw);
  const branchId = await resolvePayrollBranch(scope);
  try {
    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.payrollRun.create({ data: { tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, year: input.year, month: input.month, createdByUserId: scope.actor.id, createdByName: scope.actor.name }, select: { id: true } });
      await recordAudit(tx, scope, "PAYROLL_RUN_CREATED", "PayrollRun", row.id, { year: input.year, month: input.month });
      return row;
    });
    return getRunListItem(created.id);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new HttpError("PAYROLL_RUN_PERIOD_EXISTS", `A payroll run for ${period(input.year, input.month)} already exists for this branch`);
    throw err;
  }
}

async function getRunListItem(runId: string): Promise<PayrollRunListItemDto> {
  const r = await prisma.payrollRun.findUniqueOrThrow({ where: { id: runId }, select: listSelect });
  return listDto(r);
}

/** Present/absent/late/half-day/on-leave/not-marked counts + paid/unpaid
 * leave day counts for one staff member over the run's period —
 * INFORMATIONAL ONLY, never read by the calculation above. */
async function computeAttendanceLeaveSummary(schoolId: string, staffId: string, start: Date, end: Date) {
  const records = await prisma.staffAttendanceRecord.findMany({ where: { schoolId, staffId, date: { gte: start, lte: end } }, select: { status: true } });
  const totalDaysInPeriod = end.getUTCDate();
  const counts = { present: 0, absent: 0, late: 0, halfDay: 0, onLeave: 0 };
  for (const r of records) {
    if (r.status === "PRESENT") counts.present++;
    else if (r.status === "ABSENT") counts.absent++;
    else if (r.status === "LATE") counts.late++;
    else if (r.status === "HALF_DAY") counts.halfDay++;
    else if (r.status === "ON_LEAVE") counts.onLeave++;
  }
  const notMarked = Math.max(0, totalDaysInPeriod - records.length);

  const leaveRequests = await prisma.leaveRequest.findMany({
    where: { schoolId, staffId, status: "APPROVED", startDate: { lte: end }, endDate: { gte: start } },
    select: { startDate: true, endDate: true, leaveType: { select: { isPaid: true } } },
  });
  let paidLeaveDays = 0, unpaidLeaveDays = 0;
  for (const lr of leaveRequests) {
    const from = lr.startDate < start ? start : lr.startDate;
    const to = lr.endDate > end ? end : lr.endDate;
    const days = Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1);
    if (lr.leaveType.isPaid) paidLeaveDays += days;
    else unpaidLeaveDays += days;
  }

  return { ...counts, notMarked, paidLeaveDays, unpaidLeaveDays };
}

/** Calculate (or recalculate) a run — replaces its items, never accumulates. */
export async function calculatePayrollRun(scope: OrgScope, runId: string): Promise<PayrollRunDetailDto> {
  if (!(await isBroadPayrollManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const run = await requireRunInScope(scope, runId);
  if (run.status !== "DRAFT" && run.status !== "CALCULATED") throw new HttpError("INVALID_PAYROLL_TRANSITION", `Cannot calculate a run in "${run.status.toLowerCase()}" status`);

  const { start, end } = periodBounds(run.year, run.month);
  const eligibleStaff = await prisma.staff.findMany({ where: { schoolId: scope.schoolId, branchId: run.branchId, status: "ACTIVE" }, select: { id: true, employeeCode: true, firstName: true, lastName: true, displayName: true } });

  type ItemInput = { staffId: string; employeeCode: string; staffName: string; salaryStructureId: string; salaryStructureName: string; lines: { componentId: string; componentName: string; type: "EARNING" | "DEDUCTION"; amount: number }[]; summary: Awaited<ReturnType<typeof computeAttendanceLeaveSummary>> };
  const itemInputs: ItemInput[] = [];
  for (const staff of eligibleStaff) {
    const assignment = await resolveEffectiveAssignment(scope.schoolId, staff.id, end);
    if (!assignment) continue; // honestly excluded — surfaced via staffWithoutAssignment, never fabricated
    const structure = await prisma.salaryStructure.findUniqueOrThrow({ where: { id: assignment.salaryStructureId }, select: { name: true } });
    const lines = await resolveStructureComponents(assignment.salaryStructureId);
    const summary = await computeAttendanceLeaveSummary(scope.schoolId, staff.id, start, end);
    itemInputs.push({ staffId: staff.id, employeeCode: staff.employeeCode, staffName: displayName(staff), salaryStructureId: assignment.salaryStructureId, salaryStructureName: structure.name, lines, summary });
  }

  let totalGross = 0, totalDeductions = 0, totalNet = 0;
  await prisma.$transaction(async (tx) => {
    await tx.payrollRunItem.deleteMany({ where: { payrollRunId: runId } }); // cascades to components
    for (const item of itemInputs) {
      const { grossEarnings, totalDeductions: itemDeductions, netPay } = summarizeLines(item.lines);
      totalGross += grossEarnings; totalDeductions += itemDeductions; totalNet += netPay;
      await tx.payrollRunItem.create({
        data: {
          payrollRunId: runId, staffId: item.staffId, employeeCode: item.employeeCode, staffName: item.staffName,
          salaryStructureId: item.salaryStructureId, salaryStructureName: item.salaryStructureName,
          grossEarnings, totalDeductions: itemDeductions, netPay,
          presentDays: item.summary.present, absentDays: item.summary.absent, lateDays: item.summary.late, halfDays: item.summary.halfDay, onLeaveDays: item.summary.onLeave, notMarkedDays: item.summary.notMarked,
          paidLeaveDays: item.summary.paidLeaveDays, unpaidLeaveDays: item.summary.unpaidLeaveDays,
          components: { create: item.lines.map((l) => ({ componentId: l.componentId, componentName: l.componentName, type: l.type, amount: l.amount, source: "STRUCTURE" as const })) },
        },
      });
    }
    await tx.payrollRun.update({ where: { id: runId }, data: { status: "CALCULATED", calculatedAt: new Date(), totalGross: Math.round(totalGross * 100) / 100, totalDeductions: Math.round(totalDeductions * 100) / 100, totalNet: Math.round(totalNet * 100) / 100 } });
    await recordAudit(tx, scope, "PAYROLL_CALCULATED", "PayrollRun", runId, { staffCount: itemInputs.length });
  });
  return getPayrollRun(scope, runId);
}

export const addManualPayrollAdjustmentSchema = z.object({ componentId: z.string().min(1), amount: z.number().min(0).max(10_000_000), reason: z.string().trim().min(1).max(500) });

export async function addManualPayrollAdjustment(scope: OrgScope, runId: string, itemId: string, raw: unknown): Promise<PayrollRunDetailDto> {
  if (!(await isBroadPayrollManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const run = await requireRunInScope(scope, runId);
  if (run.status !== "DRAFT" && run.status !== "CALCULATED") throw new HttpError("INVALID_PAYROLL_TRANSITION", "Manual adjustments are only allowed before a run is finalized");
  const input = parseInput(addManualPayrollAdjustmentSchema, raw);
  const item = await prisma.payrollRunItem.findFirst({ where: { id: itemId, payrollRunId: runId }, select: { id: true, grossEarnings: true, totalDeductions: true } });
  if (!item) throw new HttpError("PAYROLL_RUN_ITEM_NOT_FOUND", "Payroll run item not found");
  const component = await prisma.salaryComponent.findFirst({ where: { id: input.componentId, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true, name: true, type: true } });
  if (!component) throw new HttpError("SALARY_COMPONENT_NOT_FOUND", "Salary component not found or archived");

  await prisma.$transaction(async (tx) => {
    await tx.payrollRunItemComponent.create({ data: { payrollRunItemId: itemId, componentId: component.id, componentName: component.name, type: component.type, amount: input.amount, source: "MANUAL", manualReason: input.reason, createdByUserId: scope.actor.id, createdByName: scope.actor.name } });
    const grossDelta = component.type === "EARNING" ? input.amount : 0;
    const deductionDelta = component.type === "DEDUCTION" ? input.amount : 0;
    const newGross = dec(item.grossEarnings) + grossDelta;
    const newDeductions = dec(item.totalDeductions) + deductionDelta;
    await tx.payrollRunItem.update({ where: { id: itemId }, data: { grossEarnings: newGross, totalDeductions: newDeductions, netPay: newGross - newDeductions } });
    const totals = await tx.payrollRunItem.aggregate({ where: { payrollRunId: runId }, _sum: { grossEarnings: true, totalDeductions: true, netPay: true } });
    await tx.payrollRun.update({ where: { id: runId }, data: { totalGross: dec(totals._sum.grossEarnings), totalDeductions: dec(totals._sum.totalDeductions), totalNet: dec(totals._sum.netPay) } });
    await recordAudit(tx, scope, "PAYROLL_CALCULATED", "PayrollRunItem", itemId, { manualComponent: component.name, amount: input.amount, reason: input.reason });
  });
  return getPayrollRun(scope, runId);
}

export async function finalizePayrollRun(scope: OrgScope, runId: string): Promise<PayrollRunDetailDto> {
  if (!(await isBroadPayrollManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  await requireRunInScope(scope, runId); // 404 before we even try to lock

  await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string; status: string }[]>`SELECT id, status FROM payroll_runs WHERE id = ${runId} AND "schoolId" = ${scope.schoolId} FOR UPDATE`;
    if (locked.length === 0) throw new HttpError("PAYROLL_RUN_NOT_FOUND", "Payroll run not found");
    if (locked[0].status !== "CALCULATED") throw new HttpError("INVALID_PAYROLL_TRANSITION", `Cannot finalize a run in "${locked[0].status.toLowerCase()}" status`);

    const itemCount = await tx.payrollRunItem.count({ where: { payrollRunId: runId } });
    if (itemCount === 0) throw new HttpError("PAYROLL_RUN_NOT_CALCULATED", "This run has no calculated staff to finalize");
    const negative = await tx.payrollRunItem.count({ where: { payrollRunId: runId, netPay: { lt: 0 } } });
    if (negative > 0) throw new HttpError("PAYROLL_RUN_HAS_NEGATIVE_NET_PAY", "One or more staff have a negative net pay — resolve before finalizing");

    await tx.payrollRun.update({ where: { id: runId }, data: { status: "FINALIZED", finalizedAt: new Date(), finalizedByName: scope.actor.name } });
    await recordAudit(tx, scope, "PAYROLL_FINALIZED", "PayrollRun", runId);
  });
  return getPayrollRun(scope, runId);
}
