// POST /api/inventory/adjustments — explicit, reasoned stock correction
// (e.g. stocktake reconciliation). A reason is mandatory. inventory.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { adjustStock } from "@/lib/server/inventory/adjustments";

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("inventory.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "inventory");
    return ok(await adjustStock(scope, await readJson(request)));
  });
}
