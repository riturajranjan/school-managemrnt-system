// GET /api/library/dashboard — real, DB-derived counts. library.view.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getLibraryDashboard } from "@/lib/server/library/dashboard";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("library.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "library");
    return ok(await getLibraryDashboard(scope));
  });
}
