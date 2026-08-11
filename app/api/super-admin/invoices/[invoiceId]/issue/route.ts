// POST /api/super-admin/invoices/[invoiceId]/issue — DRAFT → OPEN. platform.invoices.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { issueInvoice } from "@/lib/server/platform/invoices-service";

type Ctx = { params: Promise<{ invoiceId: string }> };

export async function POST(_request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const ctx = await requirePermission("platform.invoices.manage");
    const { invoiceId } = await params;
    return ok(await issueInvoice({ id: ctx.user.id, name: ctx.user.name ?? null }, invoiceId));
  });
}
