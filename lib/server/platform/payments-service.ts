// Platform (Super Admin) payments service (Phase SA-4E). A Payment is a real
// financial record settling an Invoice. Recording a payment atomically updates
// the invoice (amountPaid↑ / amountDue↓, → PAID when fully settled); reversal
// undoes it (PAID → OPEN). Money is Decimal end to end. This is an internal
// manual ledger — NO payment gateway.
//
// Concurrency: settlement re-reads the invoice under a `SELECT … FOR UPDATE`
// row lock inside an interactive transaction, so two concurrent payments cannot
// over-settle the same invoice — the second blocks until the first commits, then
// sees the updated amountDue and is validated against it.
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { parseInput } from "@/lib/server/validation";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import type { OrgScope } from "@/lib/server/api/scope";
import type { ListMeta } from "@/lib/server/api/response";
import { invoiceStatusToUi, paymentMethodFromUi, paymentMethodToUi, paymentStatusFromUi, paymentStatusToUi } from "@/lib/server/api/enums";
import { Prisma } from "@/lib/generated/prisma/client";

export type PaymentActor = { id: string; name: string | null };

// --- Validation -------------------------------------------------------------

const methodUi = z.enum(["cash", "bank-transfer", "upi", "cheque", "other"]);

export const paymentCreateSchema = z.object({
  invoiceId: z.string().trim().min(1, "invoiceId is required"),
  // Positive amount with ≤2 decimal places (money). Currency/tenant/etc. are
  // resolved from the invoice server-side — never trusted from the client.
  amount: z
    .number()
    .positive("Amount must be greater than 0")
    .refine((n) => Number.isFinite(n) && Math.round(n * 100) === n * 100, "Amount cannot have more than 2 decimal places"),
  method: methodUi,
  reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
  receivedAt: z.coerce.date().optional(),
});

// --- Serializer -------------------------------------------------------------

type PaymentRow = Prisma.PaymentGetPayload<{
  include: {
    school: { select: { id: true; name: true; code: true } };
    tenant: { select: { id: true; name: true; slug: true } };
    invoice: { select: { id: true; invoiceNumber: true; status: true; totalAmount: true; amountDue: true } };
    subscription: { select: { id: true; plan: { select: { code: true; name: true } } } };
  };
}>;

const dec = (d: Prisma.Decimal) => Number(d);
const iso = (d: Date | null) => (d ? d.toISOString() : null);

function serialize(p: PaymentRow) {
  return {
    id: p.id,
    paymentNumber: p.paymentNumber,
    status: paymentStatusToUi[p.status],
    method: paymentMethodToUi[p.method],
    amount: dec(p.amount),
    currency: p.currency,
    reference: p.reference,
    notes: p.notes,
    receivedAt: p.receivedAt.toISOString(),
    reversedAt: iso(p.reversedAt),
    recordedBy: { id: p.recordedByUserId, name: p.recordedByName },
    invoice: {
      id: p.invoice.id,
      invoiceNumber: p.invoice.invoiceNumber,
      status: invoiceStatusToUi[p.invoice.status],
      totalAmount: dec(p.invoice.totalAmount),
      amountDue: dec(p.invoice.amountDue),
    },
    school: { id: p.school.id, name: p.school.name, code: p.school.code },
    tenant: { id: p.tenant.id, name: p.tenant.name, slug: p.tenant.slug },
    subscription: { id: p.subscription.id, planCode: p.subscription.plan.code, planName: p.subscription.plan.name },
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export type PaymentDto = ReturnType<typeof serialize>;

const includeRelations = {
  school: { select: { id: true, name: true, code: true } },
  tenant: { select: { id: true, name: true, slug: true } },
  invoice: { select: { id: true, invoiceNumber: true, status: true, totalAmount: true, amountDue: true } },
  subscription: { select: { id: true, plan: { select: { code: true, name: true } } } },
} as const;

function auditScope(actor: PaymentActor, tenantId: string, schoolId: string): OrgScope {
  return { tenantId, schoolId, branchId: null, academicSessionId: null, actor };
}

// --- Reads ------------------------------------------------------------------

export type PaymentListParams = {
  page: number;
  pageSize: number;
  search?: string;
  schoolId?: string;
  method?: string;
  status?: string;
  from?: string;
  to?: string;
  sort?: "receivedAt" | "createdAt";
  order?: "asc" | "desc";
};

export async function listPayments(params: PaymentListParams) {
  const where: Prisma.PaymentWhereInput = {};
  if (params.search) {
    const q = params.search.trim();
    where.OR = [
      { paymentNumber: { contains: q, mode: "insensitive" } },
      { reference: { contains: q, mode: "insensitive" } },
      { invoice: { invoiceNumber: { contains: q, mode: "insensitive" } } },
      { school: { name: { contains: q, mode: "insensitive" } } },
      { tenant: { name: { contains: q, mode: "insensitive" } } },
    ];
  }
  if (params.schoolId) where.schoolId = params.schoolId;
  if (params.method && paymentMethodFromUi[params.method]) where.method = paymentMethodFromUi[params.method];
  if (params.status && paymentStatusFromUi[params.status]) where.status = paymentStatusFromUi[params.status];
  if (params.from || params.to) {
    where.receivedAt = {};
    if (params.from) where.receivedAt.gte = new Date(params.from);
    if (params.to) where.receivedAt.lte = new Date(params.to);
  }

  const order = params.order ?? "desc";
  const orderBy: Prisma.PaymentOrderByWithRelationInput = params.sort === "createdAt" ? { createdAt: order } : { receivedAt: order };

  const [total, rows] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({ where, orderBy, skip: (params.page - 1) * params.pageSize, take: params.pageSize, include: includeRelations }),
  ]);
  const meta: ListMeta = { page: params.page, pageSize: params.pageSize, total, totalPages: Math.max(1, Math.ceil(total / params.pageSize)) };
  return { data: rows.map(serialize), meta };
}

export async function getPayment(id: string) {
  const p = await prisma.payment.findUnique({ where: { id }, include: includeRelations });
  if (!p) throw new HttpError("PAYMENT_NOT_FOUND", "Payment not found");
  return serialize(p);
}

/** Sum of non-reversed (SUCCEEDED) payment amounts — real collected cash (all-time). */
export async function collectedTotal(): Promise<number> {
  const agg = await prisma.payment.aggregate({ where: { status: "SUCCEEDED" }, _sum: { amount: true } });
  return Number(agg._sum.amount ?? 0);
}

// --- Writes -----------------------------------------------------------------

async function nextPaymentNumber(tx: Prisma.TransactionClient, year: number): Promise<string> {
  const rows = await tx.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('payment_number_seq') AS nextval`;
  return `PAY-${year}-${String(Number(rows[0].nextval)).padStart(6, "0")}`;
}

export async function recordPayment(actor: PaymentActor, raw: unknown) {
  const input = parseInput(paymentCreateSchema, raw);
  const amount = new Prisma.Decimal(input.amount);
  const receivedAt = input.receivedAt ?? new Date();

  const paymentId = await prisma.$transaction(async (tx) => {
    // Lock the invoice row so concurrent settlements serialize on it.
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM invoices WHERE id = ${input.invoiceId} FOR UPDATE`;
    if (locked.length === 0) throw new HttpError("INVOICE_NOT_FOUND", "Invoice not found");

    const invoice = await tx.invoice.findUniqueOrThrow({
      where: { id: input.invoiceId },
      select: { id: true, status: true, currency: true, amountPaid: true, amountDue: true, tenantId: true, schoolId: true, subscriptionId: true, invoiceNumber: true },
    });
    if (invoice.status !== "OPEN") throw new HttpError("INVOICE_NOT_OPEN", `Only an open invoice can be paid (is ${invoiceStatusToUi[invoice.status]})`);
    if (amount.greaterThan(invoice.amountDue)) throw new HttpError("PAYMENT_EXCEEDS_AMOUNT_DUE", "Payment exceeds the amount due");

    const newPaid = invoice.amountPaid.plus(amount);
    const newDue = invoice.amountDue.minus(amount);
    const fullySettled = newDue.isZero();

    const paymentNumber = await nextPaymentNumber(tx, receivedAt.getUTCFullYear());
    const payment = await tx.payment.create({
      data: {
        paymentNumber,
        tenantId: invoice.tenantId,
        schoolId: invoice.schoolId,
        invoiceId: invoice.id,
        subscriptionId: invoice.subscriptionId,
        status: "SUCCEEDED",
        method: paymentMethodFromUi[input.method],
        amount,
        currency: invoice.currency,
        reference: input.reference ?? null,
        notes: input.notes ?? null,
        receivedAt,
        recordedByUserId: actor.id,
        recordedByName: actor.name,
      },
      select: { id: true },
    });

    await tx.invoice.update({
      where: { id: invoice.id },
      data: { amountPaid: newPaid, amountDue: newDue, status: fullySettled ? "PAID" : "OPEN", paidAt: fullySettled ? new Date() : null },
    });

    await recordAudit(tx, auditScope(actor, invoice.tenantId, invoice.schoolId), "PAYMENT_RECORDED", "Payment", payment.id, {
      paymentNumber,
      invoiceNumber: invoice.invoiceNumber,
      amount: Number(amount),
      currency: invoice.currency,
      fullySettled,
    });
    return payment.id;
  });

  return getPayment(paymentId);
}

export async function reversePayment(actor: PaymentActor, id: string) {
  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id },
      select: { id: true, status: true, amount: true, invoiceId: true, tenantId: true, schoolId: true, paymentNumber: true },
    });
    if (!payment) throw new HttpError("PAYMENT_NOT_FOUND", "Payment not found");
    if (payment.status === "REVERSED") throw new HttpError("PAYMENT_ALREADY_REVERSED", "Payment is already reversed");

    // Lock the invoice before adjusting its balances.
    await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${payment.invoiceId} FOR UPDATE`;
    const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: payment.invoiceId }, select: { status: true, amountPaid: true, amountDue: true, invoiceNumber: true } });

    const newPaid = invoice.amountPaid.minus(payment.amount);
    const newDue = invoice.amountDue.plus(payment.amount);
    // Reversing a payment re-opens a settled invoice.
    const reopen = invoice.status === "PAID";

    await tx.payment.update({ where: { id }, data: { status: "REVERSED", reversedAt: new Date() } });
    await tx.invoice.update({
      where: { id: payment.invoiceId },
      data: { amountPaid: newPaid, amountDue: newDue, status: reopen ? "OPEN" : undefined, paidAt: reopen ? null : undefined },
    });
    await recordAudit(tx, auditScope(actor, payment.tenantId, payment.schoolId), "PAYMENT_REVERSED", "Payment", payment.id, {
      paymentNumber: payment.paymentNumber,
      invoiceNumber: invoice.invoiceNumber,
      amount: Number(payment.amount),
    });
  });

  return getPayment(id);
}
