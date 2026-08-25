// POST /api/accounting/purchase-orders/[poId]/approve — DRAFT -> APPROVED. accounting.manage.
// Never writes a JournalEntry — a PO is not a payment.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { approvePurchaseOrder } from "@/lib/server/accounting/purchase-orders";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ poId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("accounting.manage");
    const scope = await requireOrgScope(ctx);
    const { poId } = await params;
    const data = await approvePurchaseOrder(scope, poId);
    return ok(data);
  });
}
