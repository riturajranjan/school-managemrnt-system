// GET  /api/assets — real asset register. assets.view.
// POST /api/assets — create an asset (server-generated assetTag). assets.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { createAsset, listAssets } from "@/lib/server/assets/register";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("assets.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "assets");
    const sp = request.nextUrl.searchParams;
    return ok(await listAssets(scope, { search: singleParam(sp, "search"), status: singleParam(sp, "status"), category: singleParam(sp, "category") }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("assets.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "assets");
    return ok(await createAsset(scope, await readJson(request)));
  });
}
