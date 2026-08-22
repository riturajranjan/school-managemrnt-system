// GET /api/counseling/dashboard — DB-derived counts only. counseling.view.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getCounselingDashboard } from "@/lib/server/counseling/dashboard";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("counseling.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "counseling");
    return ok(await getCounselingDashboard(scope));
  });
}
