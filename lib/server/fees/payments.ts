// Fee Collection (Phase 9F) — real FeePayment + FeePaymentAllocation.
// receiptNumber IS the receipt (see the schema doc comment) — there is no
// separate Receipt model, and it is immutable once issued (no cancel/reissue
// endpoint; see the Fees frontend cutover notes for what that trades off).
//
// CONCURRENCY: every charge an allocation targets is row-locked (`SELECT ...
// FOR UPDATE`) before its live balance is recomputed, inside the same
// transaction that inserts the allocation — two concurrent payments against
// the same charge can never both succeed past its remaining balance.
//
// METHODS: CASH/UPI/CARD/BANK_TRANSFER/CHEQUE/OTHER are all MANUALLY RECORDED
// — there is no payment-gateway integration in this repo, so a non-CASH
// method here means "the school received this by that means and is
// recording it," never "this system processed an online transaction."
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { ListMeta } from "@/lib/server/api/response";
import type { FeePaymentDto, FeePaymentMethodDto, FeeReconciliationStatusDto, RecordFeePaymentRequest } from "@/lib/api/contracts";
import { computeCharge } from "./balance";
import { dec } from "./money";
import { nextReceiptNumber } from "./receipt-number";
import { isBroadFeeManager } from "./access";
import { postFeePaymentToAccounting } from "@/lib/server/accounting/fee-posting";

const METHOD_TO_DB: Record<FeePaymentMethodDto, string> = { cash: "CASH", upi: "UPI", card: "CARD", bank_transfer: "BANK_TRANSFER", cheque: "CHEQUE", other: "OTHER" };
const methodToUi = (m: string): FeePaymentMethodDto => m.toLowerCase() as FeePaymentMethodDto;
const reconToUi = (r: string): FeeReconciliationStatusDto => r.toLowerCase() as FeeReconciliationStatusDto;
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");
const parseDate = (d: string) => new Date(`${d}T00:00:00.000Z`);
const dateToUi = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

const paymentSelect = {
  id: true, receiptNumber: true, studentId: true, amount: true, currency: true, method: true, paymentDate: true,
  reference: true, chequeNumber: true, chequeDate: true, bankName: true, notes: true, receivedByName: true,
  reconciliationStatus: true, reconciledByName: true, reconciledAt: true, reconciliationNote: true, createdAt: true,
  student: { select: { firstName: true, lastName: true, admissionNumber: true, enrollments: { where: { status: "ENROLLED" as const }, take: 1, select: { class: { select: { name: true } }, section: { select: { name: true } } } } } },
  allocations: { select: { chargeId: true, amount: true, charge: { select: { categoryName: true, itemName: true } } } },
  refunds: { select: { amount: true } },
} satisfies Prisma.FeePaymentSelect;
type PaymentRow = Prisma.FeePaymentGetPayload<{ select: typeof paymentSelect }>;

function toDto(p: PaymentRow): FeePaymentDto {
  const enrollment = p.student.enrollments[0];
  return {
    id: p.id, receiptNumber: p.receiptNumber, studentId: p.studentId, studentName: `${p.student.firstName} ${p.student.lastName}`, admissionNumber: p.student.admissionNumber,
    className: enrollment?.class.name ?? null, sectionName: enrollment?.section.name ?? null,
    amount: dec(p.amount), currency: p.currency, method: methodToUi(p.method), paymentDate: dateToUi(p.paymentDate)!,
    reference: p.reference, chequeNumber: p.chequeNumber, chequeDate: dateToUi(p.chequeDate), bankName: p.bankName, notes: p.notes,
    receivedByName: p.receivedByName, reconciliationStatus: reconToUi(p.reconciliationStatus), reconciledByName: p.reconciledByName,
    reconciledAt: p.reconciledAt?.toISOString() ?? null, reconciliationNote: p.reconciliationNote,
    allocations: p.allocations.map((a) => ({ chargeId: a.chargeId, categoryName: a.charge.categoryName, itemName: a.charge.itemName, amount: dec(a.amount) })),
    refundedAmount: p.refunds.reduce((s, r) => s + dec(r.amount), 0),
    createdAt: p.createdAt.toISOString(),
  };
}

export const listFeePaymentsSchema = z.object({ studentId: z.string().optional(), method: z.enum(["cash", "upi", "card", "bank_transfer", "cheque", "other"]).optional(), reconciliationStatus: z.enum(["unreconciled", "reconciled", "mismatch"]).optional(), from: dateStr.optional(), to: dateStr.optional(), page: z.number().int().min(1).default(1), pageSize: z.number().int().min(1).max(100).default(20) });

export async function listFeePayments(scope: OrgScope, raw: unknown): Promise<{ data: FeePaymentDto[]; meta: ListMeta }> {
  const input = parseInput(listFeePaymentsSchema, raw);
  const where: Prisma.FeePaymentWhereInput = {
    schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}),
    ...(input.studentId ? { studentId: input.studentId } : {}),
    ...(input.method ? { method: METHOD_TO_DB[input.method] as never } : {}),
    ...(input.reconciliationStatus ? { reconciliationStatus: input.reconciliationStatus.toUpperCase() as never } : {}),
    ...(input.from || input.to ? { paymentDate: { ...(input.from ? { gte: parseDate(input.from) } : {}), ...(input.to ? { lte: parseDate(input.to) } : {}) } } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.feePayment.count({ where }),
    prisma.feePayment.findMany({ where, orderBy: { createdAt: "desc" }, skip: (input.page - 1) * input.pageSize, take: input.pageSize, select: paymentSelect }),
  ]);
  return { data: rows.map(toDto), meta: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.max(1, Math.ceil(total / input.pageSize)) } };
}

export async function getFeePayment(scope: OrgScope, paymentId: string): Promise<FeePaymentDto> {
  const row = await prisma.feePayment.findFirst({ where: { id: paymentId, schoolId: scope.schoolId }, select: paymentSelect });
  if (!row) throw new HttpError("FEE_PAYMENT_NOT_FOUND", "Payment not found");
  return toDto(row);
}

export const recordFeePaymentSchema = z.object({
  studentId: z.string().min(1),
  allocations: z.array(z.object({ chargeId: z.string().min(1), amount: z.number().positive().max(10_000_000) })).min(1).max(100),
  method: z.enum(["cash", "upi", "card", "bank_transfer", "cheque", "other"]),
  paymentDate: dateStr.optional(),
  reference: z.string().trim().max(120).optional(),
  chequeNumber: z.string().trim().max(60).optional(),
  chequeDate: dateStr.optional(),
  bankName: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
});

export async function recordFeePayment(scope: OrgScope, raw: unknown): Promise<FeePaymentDto> {
  const input: RecordFeePaymentRequest = parseInput(recordFeePaymentSchema, raw);
  const student = await prisma.student.findFirst({ where: { id: input.studentId, schoolId: scope.schoolId }, select: { id: true, academicSessionId: true, branchId: true } });
  if (!student) throw new HttpError("NOT_FOUND", "Student not found");

  const chargeIds = [...new Set(input.allocations.map((a) => a.chargeId))];
  if (chargeIds.length !== input.allocations.length) throw new HttpError("VALIDATION_ERROR", "Duplicate charge in allocation list");
  const amount = input.allocations.reduce((s, a) => s + a.amount, 0);
  if (amount <= 0) throw new HttpError("INVALID_PAYMENT_AMOUNT", "Payment amount must be greater than zero");

  const paymentDate = input.paymentDate ? parseDate(input.paymentDate) : new Date();
  const school = await prisma.school.findUniqueOrThrow({ where: { id: scope.schoolId }, select: { code: true, currency: true } });

  const created = await prisma.$transaction(async (tx) => {
    // Lock every targeted charge before recomputing its live balance — the
    // real concurrency guarantee (see the file doc comment).
    await tx.$queryRaw`SELECT id FROM fee_charges WHERE id = ANY(${chargeIds}) FOR UPDATE`;
    const charges = await tx.feeCharge.findMany({
      where: { id: { in: chargeIds }, studentId: input.studentId, schoolId: scope.schoolId },
      select: { id: true, amount: true, dueDate: true, adjustments: { select: { kind: true, computedAmount: true } }, allocations: { select: { amount: true } } },
    });
    if (charges.length !== chargeIds.length) throw new HttpError("FEE_CHARGE_NOT_FOUND", "One or more fee charges were not found for this student");

    for (const alloc of input.allocations) {
      const charge = charges.find((c) => c.id === alloc.chargeId)!;
      const calc = computeCharge(charge as never);
      if (alloc.amount > calc.balance + 0.005) throw new HttpError("PAYMENT_EXCEEDS_OUTSTANDING", `Allocation of ${alloc.amount} exceeds the outstanding balance of ${calc.balance} for one charge`);
    }

    const receiptNumber = await nextReceiptNumber(tx, scope.schoolId, school.code, paymentDate.getUTCFullYear());
    const payment = await tx.feePayment.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: scope.branchId ?? student.branchId, academicSessionId: student.academicSessionId,
        studentId: input.studentId, receiptNumber, amount, currency: school.currency, method: METHOD_TO_DB[input.method] as never, paymentDate,
        reference: input.reference ?? null, chequeNumber: input.chequeNumber ?? null, chequeDate: input.chequeDate ? parseDate(input.chequeDate) : null,
        bankName: input.bankName ?? null, notes: input.notes ?? null, receivedByUserId: scope.actor.id, receivedByName: scope.actor.name,
      },
      select: { id: true },
    });
    await tx.feePaymentAllocation.createMany({ data: input.allocations.map((a) => ({ paymentId: payment.id, chargeId: a.chargeId, amount: a.amount })) });
    await recordAudit(tx, scope, "FEE_PAYMENT_RECORDED", "FeePayment", payment.id, { receiptNumber, amount });

    // Real accounting effect (Phase 9G), same transaction — either both commit or neither does.
    await postFeePaymentToAccounting(tx, scope, {
      id: payment.id, amount: new Prisma.Decimal(amount), method: METHOD_TO_DB[input.method], paymentDate,
      allocations: input.allocations.map((a) => ({ chargeId: a.chargeId, amount: new Prisma.Decimal(a.amount) })),
    });
    return payment.id;
  });
  return getFeePayment(scope, created);
}

export const reconcilePaymentSchema = z.object({ status: z.enum(["reconciled", "mismatch"]), note: z.string().trim().max(500).optional() });

export async function reconcilePayment(scope: OrgScope, paymentId: string, raw: unknown): Promise<FeePaymentDto> {
  if (!(await isBroadFeeManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input = parseInput(reconcilePaymentSchema, raw);
  const existing = await prisma.feePayment.findFirst({ where: { id: paymentId, schoolId: scope.schoolId }, select: { id: true } });
  if (!existing) throw new HttpError("FEE_PAYMENT_NOT_FOUND", "Payment not found");
  await prisma.$transaction(async (tx) => {
    await tx.feePayment.update({
      where: { id: paymentId },
      data: { reconciliationStatus: input.status.toUpperCase() as never, reconciledByUserId: scope.actor.id, reconciledByName: scope.actor.name, reconciledAt: new Date(), reconciliationNote: input.note ?? null },
    });
    await recordAudit(tx, scope, "FEE_PAYMENT_RECONCILED", "FeePayment", paymentId, { status: input.status });
  });
  return getFeePayment(scope, paymentId);
}

export { paymentSelect, toDto as paymentToDto };
