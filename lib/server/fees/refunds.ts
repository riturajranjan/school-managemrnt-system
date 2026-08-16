// Fee Refunds (Phase 9F) — always against a real FeePayment. Concurrency-safe:
// the payment row is locked before its refundable-remaining amount (payment
// amount minus every prior refund) is recomputed, inside the same
// transaction that inserts the new refund — two concurrent refund requests
// against the same payment can never both succeed past what remains.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { FeeRefundDto } from "@/lib/api/contracts";
import { dec } from "./money";
import { postFeeRefundToAccounting } from "@/lib/server/accounting/fee-posting";

function toDto(r: { id: string; paymentId: string; amount: Prisma.Decimal; reason: string; refundedByName: string | null; refundedAt: Date }): FeeRefundDto {
  return { id: r.id, paymentId: r.paymentId, amount: dec(r.amount), reason: r.reason, refundedByName: r.refundedByName, refundedAt: r.refundedAt.toISOString() };
}

export async function listFeeRefunds(scope: OrgScope, paymentId: string): Promise<FeeRefundDto[]> {
  const rows = await prisma.feeRefund.findMany({ where: { paymentId, schoolId: scope.schoolId }, orderBy: { refundedAt: "desc" } });
  return rows.map(toDto);
}

export type FeeRefundListItemDto = FeeRefundDto & { receiptNumber: string; studentName: string };

export async function listAllFeeRefunds(scope: OrgScope): Promise<FeeRefundListItemDto[]> {
  const rows = await prisma.feeRefund.findMany({
    where: { schoolId: scope.schoolId },
    orderBy: { refundedAt: "desc" },
    select: { id: true, paymentId: true, amount: true, reason: true, refundedByName: true, refundedAt: true, payment: { select: { receiptNumber: true, student: { select: { firstName: true, lastName: true } } } } },
  });
  return rows.map((r) => ({ ...toDto(r), receiptNumber: r.payment.receiptNumber, studentName: `${r.payment.student.firstName} ${r.payment.student.lastName}` }));
}

export const createFeeRefundSchema = z.object({ amount: z.number().positive().max(10_000_000), reason: z.string().trim().min(1).max(500) });

export async function createFeeRefund(scope: OrgScope, paymentId: string, raw: unknown): Promise<FeeRefundDto> {
  const input = parseInput(createFeeRefundSchema, raw);

  const created = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM fee_payments WHERE id = ${paymentId} FOR UPDATE`;
    const payment = await tx.feePayment.findFirst({ where: { id: paymentId, schoolId: scope.schoolId }, select: { id: true, amount: true, refunds: { select: { amount: true } } } });
    if (!payment) throw new HttpError("FEE_PAYMENT_NOT_FOUND", "Payment not found");

    const alreadyRefunded = payment.refunds.reduce((s, r) => s + dec(r.amount), 0);
    const refundable = dec(payment.amount) - alreadyRefunded;
    if (input.amount > refundable + 0.005) throw new HttpError("REFUND_EXCEEDS_REFUNDABLE", `Refund of ${input.amount} exceeds the refundable remaining amount of ${refundable}`);

    const row = await tx.feeRefund.create({
      data: { tenantId: scope.tenantId, schoolId: scope.schoolId, paymentId, amount: input.amount, reason: input.reason, refundedByUserId: scope.actor.id, refundedByName: scope.actor.name },
    });
    await recordAudit(tx, scope, "FEE_REFUND_CREATED", "FeePayment", paymentId, { refundId: row.id, amount: input.amount });

    // Real accounting effect (Phase 9G), same transaction.
    await postFeeRefundToAccounting(tx, scope, { id: row.id, paymentId, amount: new Prisma.Decimal(input.amount), refundedAt: row.refundedAt });
    return row;
  });
  return toDto(created);
}
