// GET /api/hr/dashboard — DB-derived metrics only. hr.view.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getHrDashboard } from "@/lib/server/hr/dashboard";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("hr.view");
    const scope = await requireOrgScope(ctx);
    return ok(await getHrDashboard(scope));
  });
}
