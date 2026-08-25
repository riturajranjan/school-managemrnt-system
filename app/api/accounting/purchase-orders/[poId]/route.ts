// GET /api/accounting/purchase-orders/[poId] — PO detail with items. accounting.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getPurchaseOrder } from "@/lib/server/accounting/purchase-orders";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ poId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("accounting.view");
    const scope = await requireOrgScope(ctx);
    const { poId } = await params;
    const data = await getPurchaseOrder(scope, poId);
    return ok(data);
  });
}
