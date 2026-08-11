// GET /api/super-admin/invoices/[invoiceId] — invoice detail. platform.invoices.view.
// Lifecycle changes go through dedicated endpoints (issue/void/mark-paid) — there
// is deliberately no arbitrary PATCH status mutation.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { getInvoice } from "@/lib/server/platform/invoices-service";

type Ctx = { params: Promise<{ invoiceId: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    await requirePermission("platform.invoices.view");
    const { invoiceId } = await params;
    return ok(await getInvoice(invoiceId));
  });
}
