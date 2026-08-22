// GET /api/health/dashboard — DB-derived counts only. health.view.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getHealthDashboard } from "@/lib/server/health/dashboard";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("health.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "health");
    return ok(await getHealthDashboard(scope));
  });
}
