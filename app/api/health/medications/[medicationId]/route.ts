// GET /api/health/medications/:medicationId — health.view + health.viewSensitive.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getMedicationAdministration } from "@/lib/server/health/medications";

export async function GET(_request: Request, { params }: { params: Promise<{ medicationId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("health.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "health");
    const sensitive = ctx.permissions.has("health.viewSensitive");
    const { medicationId } = await params;
    return ok(await getMedicationAdministration(scope, medicationId, sensitive));
  });
}
