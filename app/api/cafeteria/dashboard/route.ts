// GET /api/cafeteria/dashboard — DB-derived counts only. cafeteria.view.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getCafeteriaDashboard } from "@/lib/server/cafeteria/dashboard";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("cafeteria.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "cafeteria");
    return ok(await getCafeteriaDashboard(scope));
  });
}
