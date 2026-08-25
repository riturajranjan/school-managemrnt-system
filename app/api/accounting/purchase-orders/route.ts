// GET  /api/accounting/purchase-orders — list/filter purchase orders. accounting.view.
// POST /api/accounting/purchase-orders — create a DRAFT purchase order. accounting.manage.
// Creating a PO never writes a JournalEntry — it is not a payment.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createPurchaseOrder, listPurchaseOrders } from "@/lib/server/accounting/purchase-orders";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("accounting.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const page = singleParam(sp, "page"), pageSize = singleParam(sp, "pageSize");
    const { data, meta } = await listPurchaseOrders(scope, {
      status: singleParam(sp, "status"), vendorId: singleParam(sp, "vendorId"),
      page: page ? Number(page) : undefined, pageSize: pageSize ? Number(pageSize) : undefined,
    });
    return ok(data, meta);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("accounting.manage");
    const scope = await requireOrgScope(ctx);
    const data = await createPurchaseOrder(scope, await readJson(request));
    return ok(data);
  });
}
