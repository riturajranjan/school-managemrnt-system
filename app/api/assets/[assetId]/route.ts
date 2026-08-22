// GET   /api/assets/[assetId] — assets.view.
// PATCH /api/assets/[assetId] — assets.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getAsset, updateAsset } from "@/lib/server/assets/register";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ assetId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("assets.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "assets");
    const { assetId } = await params;
    return ok(await getAsset(scope, assetId));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ assetId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("assets.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "assets");
    const { assetId } = await params;
    return ok(await updateAsset(scope, assetId, await readJson(request)));
  });
}
