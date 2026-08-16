// Payroll Payment recording (Phase 9H) — records that a FINALIZED run's
// total was paid; it never initiates a real bank transfer (no gateway/bank-
// feed integration exists in this repo). Whole-run payment only — one
// PayrollPayment per PayrollRun (DB-unique), so a run can never be paid
// twice, even under real concurrency: two concurrent attempts race on a
// `SELECT ... FOR UPDATE` lock on the PayrollRun row AND the DB-unique
// constraint on payrollRunId, and only one can win.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { PayrollPaymentDto, PayrollPaymentMethodDto } from "@/lib/api/contracts";
import { dec } from "@/lib/server/fees/money";
import { isBroadPayrollManager, resolvePayrollBranch } from "./access";
import { postPayrollPaymentToAccounting } from "./payroll-posting";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");
const parseDate = (d: string) => new Date(`${d}T00:00:00.000Z`);
const METHOD_TO_DB: Record<PayrollPaymentMethodDto, string> = { cash: "CASH", upi: "UPI", card: "CARD", bank_transfer: "BANK_TRANSFER", cheque: "CHEQUE", other: "OTHER" };
const METHOD_TO_UI: Record<string, PayrollPaymentMethodDto> = { CASH: "cash", UPI: "upi", CARD: "card", BANK_TRANSFER: "bank_transfer", CHEQUE: "cheque", OTHER: "other" };

function toDto(p: { id: string; payrollRunId: string; amount: Prisma.Decimal; paymentDate: Date; method: string; reference: string | null; createdByName: string | null; createdAt: Date }): PayrollPaymentDto {
  return { id: p.id, payrollRunId: p.payrollRunId, amount: dec(p.amount), paymentDate: p.paymentDate.toISOString().slice(0, 10), method: METHOD_TO_UI[p.method], reference: p.reference, createdByName: p.createdByName, createdAt: p.createdAt.toISOString() };
}

export async function getPayrollPayment(scope: OrgScope, runId: string): Promise<PayrollPaymentDto | null> {
  const row = await prisma.payrollPayment.findFirst({ where: { payrollRunId: runId, schoolId: scope.schoolId } });
  return row ? toDto(row) : null;
}

export const recordPayrollPaymentSchema = z.object({ paymentDate: dateStr, method: z.enum(["cash", "upi", "card", "bank_transfer", "cheque", "other"]), reference: z.string().trim().max(120).optional() });

export async function recordPayrollPayment(scope: OrgScope, runId: string, raw: unknown): Promise<PayrollPaymentDto> {
  if (!(await isBroadPayrollManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input = parseInput(recordPayrollPaymentSchema, raw);
  const branchId = await resolvePayrollBranch(scope);
  const paymentDate = parseDate(input.paymentDate);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM payroll_runs WHERE id = ${runId} AND "schoolId" = ${scope.schoolId} FOR UPDATE`;
      if (locked.length === 0) throw new HttpError("PAYROLL_RUN_NOT_FOUND", "Payroll run not found");
      const run = await tx.payrollRun.findUniqueOrThrow({ where: { id: runId }, select: { status: true, totalNet: true } });
      if (run.status !== "FINALIZED") throw new HttpError("INVALID_PAYROLL_TRANSITION", `Cannot pay a run in "${run.status.toLowerCase()}" status`);
      const amount = dec(run.totalNet);

      const payment = await tx.payrollPayment.create({
        data: { tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, payrollRunId: runId, amount, paymentDate, method: METHOD_TO_DB[input.method] as never, reference: input.reference ?? null, createdByUserId: scope.actor.id, createdByName: scope.actor.name },
      });
      await tx.payrollRun.update({ where: { id: runId }, data: { status: "PAID", paidAt: new Date() } });
      await recordAudit(tx, scope, "PAYROLL_PAYMENT_RECORDED", "PayrollRun", runId, { amount });

      await postPayrollPaymentToAccounting(tx, scope, { id: payment.id, amount: payment.amount, paymentDate });
      return payment;
    });
    return toDto(created);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new HttpError("PAYROLL_ALREADY_PAID", "This payroll run has already been paid");
    throw err;
  }
}
