// Purchase Orders (Production Accounting checkpoint) — real, PostgreSQL-
// backed. A PurchaseOrder is explicitly NOT a payment: creating or approving
// one never writes a JournalEntry, moves inventory, or implies goods
// receipt — there is no accounts-payable/invoice-matching/GST engine here.
//
// V1 lifecycle only: DRAFT -> APPROVED, DRAFT -> CANCELLED. APPROVED is
// terminal — no APPROVED -> CANCELLED path exists (a safe post-approval
// cancellation needs its own design once a real receiving/payment flow
// exists; left undesigned rather than guessed at). Both transitions are a
// single guarded `updateMany` (WHERE id AND status = 'DRAFT') — one atomic
// Postgres statement, so a concurrent double-click can only ever have one
// winner; the loser sees `count === 0` and is told the order is no longer
// in DRAFT. `vendorNameSnapshot`/`vendorCodeSnapshot` and every line's
// `lineTotal` are frozen at creation — no edit endpoint exists afterward, so
// a later Vendor rename or any other edit can never change what an
// already-issued PO meant.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { ListMeta } from "@/lib/server/api/response";
import type { PurchaseOrderDetailDto, PurchaseOrderListItemDto, PurchaseOrderStatusDto } from "@/lib/api/contracts";
import { dec, money } from "@/lib/server/fees/money";
import { isBroadAccountingManager, resolveAccountingBranch } from "./access";
import { requireActiveVendor } from "./vendors";
import { nextPurchaseOrderNumber } from "./purchase-order-number";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");
const parseDate = (d: string) => new Date(`${d}T00:00:00.000Z`);
const dateToUi = (d: Date) => d.toISOString().slice(0, 10);
const STATUS_TO_UI: Record<string, PurchaseOrderStatusDto> = { DRAFT: "draft", APPROVED: "approved", CANCELLED: "cancelled" };
const STATUS_TO_DB: Record<string, string> = { draft: "DRAFT", approved: "APPROVED", cancelled: "CANCELLED" };

const listSelect = {
  id: true, poNumber: true, vendorId: true, vendorNameSnapshot: true, status: true, orderDate: true,
  expectedDeliveryDate: true, totalAmount: true, createdAt: true, items: { select: { id: true } },
} satisfies Prisma.PurchaseOrderSelect;
type ListRow = Prisma.PurchaseOrderGetPayload<{ select: typeof listSelect }>;

function listDto(p: ListRow): PurchaseOrderListItemDto {
  return {
    id: p.id, poNumber: p.poNumber, vendorId: p.vendorId, vendorName: p.vendorNameSnapshot,
    status: STATUS_TO_UI[p.status], orderDate: dateToUi(p.orderDate), expectedDeliveryDate: p.expectedDeliveryDate ? dateToUi(p.expectedDeliveryDate) : null,
    totalAmount: dec(p.totalAmount), itemCount: p.items.length, createdAt: p.createdAt.toISOString(),
  };
}

export const listPurchaseOrdersSchema = z.object({
  status: z.enum(["draft", "approved", "cancelled"]).optional(),
  vendorId: z.string().min(1).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export async function listPurchaseOrders(scope: OrgScope, raw: unknown): Promise<{ data: PurchaseOrderListItemDto[]; meta: ListMeta }> {
  const input = parseInput(listPurchaseOrdersSchema, raw);
  const where: Prisma.PurchaseOrderWhereInput = {
    schoolId: scope.schoolId,
    ...(input.status ? { status: STATUS_TO_DB[input.status] as never } : {}),
    ...(input.vendorId ? { vendorId: input.vendorId } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.purchaseOrder.count({ where }),
    prisma.purchaseOrder.findMany({ where, orderBy: { createdAt: "desc" }, skip: (input.page - 1) * input.pageSize, take: input.pageSize, select: listSelect }),
  ]);
  return { data: rows.map(listDto), meta: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.max(1, Math.ceil(total / input.pageSize)) } };
}

const detailSelect = {
  ...listSelect,
  vendorCodeSnapshot: true, subtotal: true, discountTotal: true, taxTotal: true, notes: true,
  createdByName: true, approvedByName: true, approvedAt: true, cancelledByName: true, cancelledAt: true, cancellationReason: true,
  items: { select: { id: true, description: true, quantity: true, unitRate: true, taxPercent: true, lineTotal: true } },
} satisfies Prisma.PurchaseOrderSelect;
type DetailRow = Prisma.PurchaseOrderGetPayload<{ select: typeof detailSelect }>;

function detailDto(p: DetailRow): PurchaseOrderDetailDto {
  return {
    ...listDto({ ...p, items: p.items.map((i) => ({ id: i.id })) }),
    vendorCode: p.vendorCodeSnapshot,
    items: p.items.map((i) => ({ id: i.id, description: i.description, quantity: i.quantity, unitRate: dec(i.unitRate), taxPercent: dec(i.taxPercent), lineTotal: dec(i.lineTotal) })),
    subtotal: dec(p.subtotal), discountTotal: dec(p.discountTotal), taxTotal: dec(p.taxTotal), notes: p.notes,
    createdByName: p.createdByName, approvedByName: p.approvedByName, approvedAt: p.approvedAt?.toISOString() ?? null,
    cancelledByName: p.cancelledByName, cancelledAt: p.cancelledAt?.toISOString() ?? null, cancellationReason: p.cancellationReason,
  };
}

async function requirePoInScope(scope: OrgScope, poId: string): Promise<DetailRow> {
  const row = await prisma.purchaseOrder.findFirst({ where: { id: poId, schoolId: scope.schoolId }, select: detailSelect });
  if (!row) throw new HttpError("PURCHASE_ORDER_NOT_FOUND", "Purchase order not found");
  return row;
}

export async function getPurchaseOrder(scope: OrgScope, poId: string): Promise<PurchaseOrderDetailDto> {
  return detailDto(await requirePoInScope(scope, poId));
}

const itemSchema = z.object({
  description: z.string().trim().min(1).max(200),
  quantity: z.number().int().min(1).max(1_000_000),
  unitRate: z.number().min(0).max(100_000_000),
  taxPercent: z.number().min(0).max(100).default(0),
});

export const createPurchaseOrderSchema = z.object({
  vendorId: z.string().min(1),
  orderDate: dateStr,
  expectedDeliveryDate: dateStr.optional(),
  notes: z.string().trim().max(1000).optional(),
  discountTotal: z.number().min(0).max(100_000_000).default(0),
  items: z.array(itemSchema).min(1).max(100),
});

/** Every money figure is computed once, server-side, in Prisma.Decimal — the
 * client never supplies a total. `quantity * unitRate` gives the line base;
 * `taxPercent` of that base is the line's tax; `lineTotal` is base + tax. */
function computeItemTotals(item: z.infer<typeof itemSchema>) {
  const base = money(item.quantity).times(item.unitRate);
  const tax = base.times(item.taxPercent).div(100);
  return { base, tax, lineTotal: base.plus(tax) };
}

export async function createPurchaseOrder(scope: OrgScope, raw: unknown): Promise<PurchaseOrderDetailDto> {
  if (!(await isBroadAccountingManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input = parseInput(createPurchaseOrderSchema, raw);
  const vendor = await requireActiveVendor(scope, input.vendorId);

  const computed = input.items.map(computeItemTotals);
  const subtotal = computed.reduce((s, c) => s.plus(c.base), money(0));
  const taxTotal = computed.reduce((s, c) => s.plus(c.tax), money(0));
  const discountTotal = money(input.discountTotal);
  if (discountTotal.greaterThan(subtotal.plus(taxTotal))) throw new HttpError("INVALID_PURCHASE_ORDER", "Discount cannot exceed the order's gross amount");
  const totalAmount = subtotal.plus(taxTotal).minus(discountTotal);

  const branchId = await resolveAccountingBranch(scope);

  const created = await prisma.$transaction(async (tx) => {
    const poNumber = await nextPurchaseOrderNumber(tx, scope.schoolId, parseDate(input.orderDate).getUTCFullYear());
    const row = await tx.purchaseOrder.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId,
        poNumber, vendorId: vendor.id, vendorNameSnapshot: vendor.name, vendorCodeSnapshot: vendor.code,
        status: "DRAFT", orderDate: parseDate(input.orderDate),
        expectedDeliveryDate: input.expectedDeliveryDate ? parseDate(input.expectedDeliveryDate) : null,
        notes: input.notes, subtotal, discountTotal, taxTotal, totalAmount,
        createdByUserId: scope.actor.id, createdByName: scope.actor.name,
        items: { create: input.items.map((item, i) => ({ description: item.description, quantity: item.quantity, unitRate: item.unitRate, taxPercent: item.taxPercent, lineTotal: computed[i].lineTotal })) },
      },
      select: { id: true },
    });
    await recordAudit(tx, scope, "PURCHASE_ORDER_CREATED", "PurchaseOrder", row.id, { poNumber, vendorId: vendor.id });
    return row;
  });
  return getPurchaseOrder(scope, created.id);
}

export async function approvePurchaseOrder(scope: OrgScope, poId: string): Promise<PurchaseOrderDetailDto> {
  if (!(await isBroadAccountingManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const result = await prisma.$transaction(async (tx) => {
    const { count } = await tx.purchaseOrder.updateMany({
      where: { id: poId, schoolId: scope.schoolId, status: "DRAFT" },
      data: { status: "APPROVED", approvedByUserId: scope.actor.id, approvedByName: scope.actor.name, approvedAt: new Date() },
    });
    if (count === 1) await recordAudit(tx, scope, "PURCHASE_ORDER_APPROVED", "PurchaseOrder", poId, {});
    return count;
  });
  if (result === 0) {
    const existing = await prisma.purchaseOrder.findFirst({ where: { id: poId, schoolId: scope.schoolId }, select: { status: true } });
    if (!existing) throw new HttpError("PURCHASE_ORDER_NOT_FOUND", "Purchase order not found");
    throw new HttpError("INVALID_PURCHASE_ORDER_TRANSITION", `Cannot approve a purchase order in "${existing.status.toLowerCase()}" status`);
  }
  return getPurchaseOrder(scope, poId);
}

export const cancelPurchaseOrderSchema = z.object({ reason: z.string().trim().min(1).max(500) });

export async function cancelPurchaseOrder(scope: OrgScope, poId: string, raw: unknown): Promise<PurchaseOrderDetailDto> {
  if (!(await isBroadAccountingManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input = parseInput(cancelPurchaseOrderSchema, raw);
  const result = await prisma.$transaction(async (tx) => {
    const { count } = await tx.purchaseOrder.updateMany({
      where: { id: poId, schoolId: scope.schoolId, status: "DRAFT" },
      data: { status: "CANCELLED", cancelledByUserId: scope.actor.id, cancelledByName: scope.actor.name, cancelledAt: new Date(), cancellationReason: input.reason },
    });
    if (count === 1) await recordAudit(tx, scope, "PURCHASE_ORDER_CANCELLED", "PurchaseOrder", poId, { reason: input.reason });
    return count;
  });
  if (result === 0) {
    const existing = await prisma.purchaseOrder.findFirst({ where: { id: poId, schoolId: scope.schoolId }, select: { status: true } });
    if (!existing) throw new HttpError("PURCHASE_ORDER_NOT_FOUND", "Purchase order not found");
    throw new HttpError(
      "INVALID_PURCHASE_ORDER_TRANSITION",
      existing.status === "APPROVED" ? "An approved purchase order cannot be cancelled" : `Cannot cancel a purchase order in "${existing.status.toLowerCase()}" status`,
    );
  }
  return getPurchaseOrder(scope, poId);
}
