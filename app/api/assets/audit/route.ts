// GET /api/assets/audit — cross-asset real AuditEvent feed for the Audit hub
// page (replaces the pre-migration mock ResourceAuditTrail). assets.view.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { listAssetAuditFeed } from "@/lib/server/assets/history";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("assets.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "assets");
    return ok(await listAssetAuditFeed(scope));
  });
}
