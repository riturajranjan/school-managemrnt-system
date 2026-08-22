// GET /api/inventory/dashboard — DB-derived metrics only. inventory.view.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getInventoryDashboard } from "@/lib/server/inventory/dashboard";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("inventory.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "inventory");
    return ok(await getInventoryDashboard(scope));
  });
}
