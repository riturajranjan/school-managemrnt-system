// POST /api/super-admin/invoices/[invoiceId]/mark-paid — OPEN → PAID via an
// explicit manual administrative settlement (no payment gateway, no Payment rows
// created). Real collection belongs to the future Payments phase. platform.invoices.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { markInvoicePaid } from "@/lib/server/platform/invoices-service";

type Ctx = { params: Promise<{ invoiceId: string }> };

export async function POST(_request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const ctx = await requirePermission("platform.invoices.manage");
    const { invoiceId } = await params;
    return ok(await markInvoicePaid({ id: ctx.user.id, name: ctx.user.name ?? null }, invoiceId));
  });
}
