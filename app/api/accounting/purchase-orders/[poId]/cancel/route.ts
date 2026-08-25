// POST /api/accounting/purchase-orders/[poId]/cancel — DRAFT -> CANCELLED only
// (an APPROVED order is immutable in this V1 lifecycle). accounting.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { cancelPurchaseOrder } from "@/lib/server/accounting/purchase-orders";

export async function POST(request: NextRequest, { params }: { params: Promise<{ poId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("accounting.manage");
    const scope = await requireOrgScope(ctx);
    const { poId } = await params;
    const data = await cancelPurchaseOrder(scope, poId, await readJson(request));
    return ok(data);
  });
}
