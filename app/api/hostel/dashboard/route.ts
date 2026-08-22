// GET /api/hostel/dashboard — DB-derived metrics only. hostel.view.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getHostelDashboard } from "@/lib/server/hostel/dashboard";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("hostel.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "hostel");
    return ok(await getHostelDashboard(scope));
  });
}
