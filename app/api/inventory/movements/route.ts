// GET /api/inventory/movements — paginated, filterable ledger history. inventory.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { parsePagination, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { listMovements } from "@/lib/server/inventory/movements";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("inventory.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "inventory");
    const sp = request.nextUrl.searchParams;
    const { page, pageSize } = parsePagination(sp);
    const { data, meta } = await listMovements(scope, {
      itemId: singleParam(sp, "itemId"), locationId: singleParam(sp, "locationId"), movementType: singleParam(sp, "movementType"),
      from: singleParam(sp, "from"), to: singleParam(sp, "to"), page, pageSize,
    });
    return ok(data, meta);
  });
}
