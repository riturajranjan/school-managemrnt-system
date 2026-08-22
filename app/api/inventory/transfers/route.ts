// GET  /api/inventory/transfers — inventory.view.
// POST /api/inventory/transfers — atomic TRANSFER_OUT + TRANSFER_IN pair;
//      insufficient source stock rolls back the whole transaction (no
//      half-transfer). inventory.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { listTransfers, transferStock } from "@/lib/server/inventory/transfers";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("inventory.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "inventory");
    const sp = request.nextUrl.searchParams;
    return ok(await listTransfers(scope, { itemId: singleParam(sp, "itemId") }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("inventory.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "inventory");
    return ok(await transferStock(scope, await readJson(request)));
  });
}
