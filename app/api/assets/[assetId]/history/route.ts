// GET /api/assets/[assetId]/history — real AuditEvent trail for this asset
// (create/update/assign/return/status/maintenance). assets.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getAssetHistory } from "@/lib/server/assets/history";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ assetId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("assets.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "assets");
    const { assetId } = await params;
    return ok(await getAssetHistory(scope, assetId));
  });
}
