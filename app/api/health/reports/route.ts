// GET /api/health/reports — real DB aggregates only. health.view (the
// visitsByReason breakdown additionally requires health.viewSensitive,
// resolved internally — see lib/server/health/reports.ts).
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getHealthReports } from "@/lib/server/health/reports";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("health.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "health");
    const sensitive = ctx.permissions.has("health.viewSensitive");
    return ok(await getHealthReports(scope, sensitive));
  });
}
