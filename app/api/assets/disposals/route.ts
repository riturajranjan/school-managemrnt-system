// GET /api/assets/disposals — the school-wide disposal register, real.
// assets.view.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { listAssetDisposals } from "@/lib/server/assets/disposal";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("assets.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "assets");
    return ok(await listAssetDisposals(scope));
  });
}
