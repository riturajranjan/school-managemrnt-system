// POST /api/inventory/receipts — record physical stock received. Never
// implies a purchase order/vendor accounting event. inventory.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { receiveStock } from "@/lib/server/inventory/movements";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("inventory.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "inventory");
    return ok(await receiveStock(scope, await readJson(request)));
  });
}
