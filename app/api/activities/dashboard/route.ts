// GET /api/activities/dashboard — DB-derived counts only. activities.view.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getActivityDashboard } from "@/lib/server/activities/dashboard";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("activities.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "activities");
    return ok(await getActivityDashboard(scope));
  });
}
