// Platform (Super Admin) invoices service (Phase SA-4D). Invoices are generated
// from a real Subscription; the server resolves tenant/school/commercial terms —
// the client never supplies authoritative money/ids. Money is Decimal end to end;
// only the API boundary converts to Number. OVERDUE is derived, never stored.
//
// No payment provider: PAID is reached only by an explicit manual administrative
// settlement (markPaid) and creates NO Payment rows.
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { parseInput } from "@/lib/server/validation";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import type { OrgScope } from "@/lib/server/api/scope";
import type { ListMeta } from "@/lib/server/api/response";
import { billingIntervalToUi, invoiceStatusFromUi, invoiceStatusToUi } from "@/lib/server/api/enums";
import type { Prisma } from "@/lib/generated/prisma/client";

export type InvoiceActor = { id: string; name: string | null };

// Subscriptions that can be invoiced for their current period.
const BILLABLE_STATUSES = ["ACTIVE", "PAST_DUE"];

// --- Validation -------------------------------------------------------------

export const invoiceGenerateSchema = z.object({
  subscriptionId: z.string().trim().min(1, "subscriptionId is required"),
});

// --- Serializer -------------------------------------------------------------

type InvoiceRow = Prisma.InvoiceGetPayload<{
  include: {
    school: { select: { id: true; name: true; code: true } };
    tenant: { select: { id: true; name: true; slug: true } };
    subscription: { select: { id: true; status: true; billingInterval: true; plan: { select: { code: true; name: true } } } };
    lineItems: true;
  };
}>;

const dec = (d: Prisma.Decimal) => Number(d);
const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** Derived display state — OVERDUE is computed, never stored. */
function derivedState(row: { status: string; dueAt: Date; amountDue: Prisma.Decimal }, now: Date): string {
  if (row.status === "VOID") return "void";
  if (row.status === "PAID") return "paid";
  if (row.status === "DRAFT") return "draft";
  // OPEN
  return row.dueAt.getTime() < now.getTime() && Number(row.amountDue) > 0 ? "overdue" : "open";
}

function serialize(inv: InvoiceRow, now: Date) {
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    status: invoiceStatusToUi[inv.status],
    derivedState: derivedState(inv, now),
    school: { id: inv.school.id, name: inv.school.name, code: inv.school.code },
    tenant: { id: inv.tenant.id, name: inv.tenant.name, slug: inv.tenant.slug },
    subscription: {
      id: inv.subscription.id,
      status: inv.subscription.status.toLowerCase().replace("_", "-"),
      planCode: inv.subscription.plan.code,
      planName: inv.subscription.plan.name,
      billingInterval: billingIntervalToUi[inv.subscription.billingInterval],
    },
    currency: inv.currency,
    subtotal: dec(inv.subtotal),
    taxAmount: dec(inv.taxAmount),
    discountAmount: dec(inv.discountAmount),
    totalAmount: dec(inv.totalAmount),
    amountPaid: dec(inv.amountPaid),
    amountDue: dec(inv.amountDue),
    periodStart: inv.periodStart.toISOString(),
    periodEnd: inv.periodEnd.toISOString(),
    issuedAt: iso(inv.issuedAt),
    dueAt: inv.dueAt.toISOString(),
    paidAt: iso(inv.paidAt),
    voidedAt: iso(inv.voidedAt),
    lineItems: inv.lineItems
      .slice()
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((li) => ({ id: li.id, description: li.description, quantity: li.quantity, unitAmount: dec(li.unitAmount), amount: dec(li.amount) })),
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
  };
}

export type InvoiceDto = ReturnType<typeof serialize>;

const includeRelations = {
  school: { select: { id: true, name: true, code: true } },
  tenant: { select: { id: true, name: true, slug: true } },
  subscription: { select: { id: true, status: true, billingInterval: true, plan: { select: { code: true, name: true } } } },
  lineItems: true,
} as const;

function auditScope(actor: InvoiceActor, tenantId: string, schoolId: string): OrgScope {
  return { tenantId, schoolId, branchId: null, academicSessionId: null, actor };
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

// --- Reads ------------------------------------------------------------------

export type InvoiceListParams = {
  page: number;
  pageSize: number;
  search?: string;
  status?: string; // draft | open | paid | void | overdue (derived)
  schoolId?: string;
  from?: string; // ISO date, filters createdAt >=
  to?: string; // ISO date, filters createdAt <=
  sort?: "createdAt" | "dueAt" | "invoiceNumber";
  order?: "asc" | "desc";
};

export async function listInvoices(params: InvoiceListParams) {
  const now = new Date();
  const where: Prisma.InvoiceWhereInput = {};
  if (params.search) {
    const q = params.search.trim();
    where.OR = [
      { invoiceNumber: { contains: q, mode: "insensitive" } },
      { school: { name: { contains: q, mode: "insensitive" } } },
      { tenant: { name: { contains: q, mode: "insensitive" } } },
    ];
  }
  if (params.status === "overdue") {
    where.status = "OPEN";
    where.dueAt = { lt: now };
    where.amountDue = { gt: 0 };
  } else if (params.status && invoiceStatusFromUi[params.status]) {
    where.status = invoiceStatusFromUi[params.status];
  }
  if (params.schoolId) where.schoolId = params.schoolId;
  if (params.from || params.to) {
    where.createdAt = {};
    if (params.from) where.createdAt.gte = new Date(params.from);
    if (params.to) where.createdAt.lte = new Date(params.to);
  }

  const order = params.order ?? "desc";
  let orderBy: Prisma.InvoiceOrderByWithRelationInput;
  switch (params.sort) {
    case "dueAt":
      orderBy = { dueAt: order };
      break;
    case "invoiceNumber":
      orderBy = { invoiceNumber: order };
      break;
    default:
      orderBy = { createdAt: order };
  }

  const [total, rows] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({ where, orderBy, skip: (params.page - 1) * params.pageSize, take: params.pageSize, include: includeRelations }),
  ]);
  const meta: ListMeta = { page: params.page, pageSize: params.pageSize, total, totalPages: Math.max(1, Math.ceil(total / params.pageSize)) };
  return { data: rows.map((r) => serialize(r, now)), meta };
}

export async function getInvoice(id: string) {
  const inv = await prisma.invoice.findUnique({ where: { id }, include: includeRelations });
  if (!inv) throw new HttpError("INVOICE_NOT_FOUND", "Invoice not found");
  return serialize(inv, new Date());
}

// --- Writes -----------------------------------------------------------------

export async function generateInvoice(actor: InvoiceActor, raw: unknown) {
  const input = parseInput(invoiceGenerateSchema, raw);
  const sub = await prisma.subscription.findUnique({
    where: { id: input.subscriptionId },
    select: {
      id: true,
      tenantId: true,
      schoolId: true,
      status: true,
      currency: true,
      priceAmount: true,
      billingInterval: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      plan: { select: { name: true } },
    },
  });
  if (!sub) throw new HttpError("SUBSCRIPTION_NOT_BILLABLE", "Subscription not found");
  if (!BILLABLE_STATUSES.includes(sub.status)) {
    throw new HttpError("SUBSCRIPTION_NOT_BILLABLE", `A ${sub.status.toLowerCase()} subscription cannot be invoiced`);
  }

  // Pre-check duplicate (the @@unique index is the authoritative guard).
  const existing = await prisma.invoice.findFirst({
    where: { subscriptionId: sub.id, periodStart: sub.currentPeriodStart, periodEnd: sub.currentPeriodEnd },
    select: { id: true },
  });
  if (existing) throw new HttpError("INVOICE_ALREADY_EXISTS", "An invoice already exists for this billing period");

  // Snapshot the AGREED commercial terms from the subscription (not today's plan).
  const subtotal = sub.priceAmount;
  const total = sub.priceAmount; // tax=0, discount=0 in SA-4D
  const description = `${sub.plan.name} subscription (${billingIntervalToUi[sub.billingInterval]})`;

  try {
    const created = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('invoice_number_seq') AS nextval`;
      const seq = Number(rows[0].nextval);
      const invoiceNumber = `INV-${sub.currentPeriodStart.getUTCFullYear()}-${String(seq).padStart(6, "0")}`;
      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          tenantId: sub.tenantId,
          schoolId: sub.schoolId,
          subscriptionId: sub.id,
          status: "DRAFT",
          currency: sub.currency,
          subtotal,
          taxAmount: 0,
          discountAmount: 0,
          totalAmount: total,
          amountPaid: 0,
          amountDue: total,
          periodStart: sub.currentPeriodStart,
          periodEnd: sub.currentPeriodEnd,
          dueAt: sub.currentPeriodEnd,
          lineItems: { create: [{ description, quantity: 1, unitAmount: subtotal, amount: subtotal }] },
        },
        include: includeRelations,
      });
      await recordAudit(tx, auditScope(actor, sub.tenantId, sub.schoolId), "INVOICE_GENERATED", "Invoice", invoice.id, {
        invoiceNumber,
        total: Number(total),
        currency: sub.currency,
      });
      return invoice;
    });
    return serialize(created, new Date());
  } catch (e) {
    if (isUniqueViolation(e)) throw new HttpError("INVOICE_ALREADY_EXISTS", "An invoice already exists for this billing period");
    throw e;
  }
}

/** Load an invoice (status + audit ids) or throw a typed 404. */
async function loadForTransition(id: string) {
  const inv = await prisma.invoice.findUnique({ where: { id }, select: { id: true, status: true, tenantId: true, schoolId: true, totalAmount: true } });
  if (!inv) throw new HttpError("INVOICE_NOT_FOUND", "Invoice not found");
  return inv;
}

export async function issueInvoice(actor: InvoiceActor, id: string) {
  const inv = await loadForTransition(id);
  if (inv.status !== "DRAFT") throw new HttpError("INVALID_INVOICE_TRANSITION", `Only a draft invoice can be issued (is ${invoiceStatusToUi[inv.status]})`);
  const updated = await prisma.invoice.update({ where: { id }, data: { status: "OPEN", issuedAt: new Date() }, include: includeRelations });
  await recordAudit(prisma, auditScope(actor, inv.tenantId, inv.schoolId), "INVOICE_ISSUED", "Invoice", id);
  return serialize(updated, new Date());
}

export async function voidInvoice(actor: InvoiceActor, id: string) {
  const inv = await loadForTransition(id);
  if (inv.status !== "DRAFT" && inv.status !== "OPEN") {
    throw new HttpError("INVALID_INVOICE_TRANSITION", `A ${invoiceStatusToUi[inv.status]} invoice cannot be voided`);
  }
  const updated = await prisma.invoice.update({ where: { id }, data: { status: "VOID", voidedAt: new Date() }, include: includeRelations });
  await recordAudit(prisma, auditScope(actor, inv.tenantId, inv.schoolId), "INVOICE_VOIDED", "Invoice", id);
  return serialize(updated, new Date());
}

/**
 * Manual administrative settlement (NOT a real payment). Marks an OPEN invoice
 * PAID, zeroing the amount due. No Payment record is created — real collection
 * belongs to the future Payments phase.
 */
export async function markInvoicePaid(actor: InvoiceActor, id: string) {
  const inv = await loadForTransition(id);
  if (inv.status !== "OPEN") throw new HttpError("INVALID_INVOICE_TRANSITION", `Only an open invoice can be marked paid (is ${invoiceStatusToUi[inv.status]})`);
  const now = new Date();
  const updated = await prisma.invoice.update({
    where: { id },
    data: { status: "PAID", paidAt: now, amountPaid: inv.totalAmount, amountDue: 0 },
    include: includeRelations,
  });
  await recordAudit(prisma, auditScope(actor, inv.tenantId, inv.schoolId), "INVOICE_PAID", "Invoice", id, {
    settlement: "manual-admin",
    note: "No payment gateway; manual administrative settlement",
  });
  return serialize(updated, now);
}
