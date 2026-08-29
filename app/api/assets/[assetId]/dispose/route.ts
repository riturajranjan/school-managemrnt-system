// POST /api/assets/[assetId]/dispose { reason, disposedAt, value?, recipient?,
// notes?, approvedByUserId? } — records a real terminal disposal and sets
// the asset's status to RETIRED. assets.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { disposeAsset } from "@/lib/server/assets/disposal";

export async function POST(request: NextRequest, { params }: { params: Promise<{ assetId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("assets.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "assets");
    const { assetId } = await params;
    return ok(await disposeAsset(scope, assetId, await readJson(request)));
  });
}
