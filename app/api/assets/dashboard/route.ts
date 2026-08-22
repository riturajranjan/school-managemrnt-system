// GET /api/assets/dashboard — DB-derived metrics only; no fabricated book
// value or depreciation. assets.view.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getAssetDashboard } from "@/lib/server/assets/dashboard";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("assets.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "assets");
    return ok(await getAssetDashboard(scope));
  });
}
