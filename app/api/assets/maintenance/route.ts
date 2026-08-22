// GET  /api/assets/maintenance — assets.view.
// POST /api/assets/maintenance — open a record; requires the asset be
//      AVAILABLE (moves it to MAINTENANCE). assets.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { listMaintenance, openMaintenance } from "@/lib/server/assets/maintenance";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("assets.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "assets");
    const sp = request.nextUrl.searchParams;
    return ok(await listMaintenance(scope, { assetId: singleParam(sp, "assetId"), status: singleParam(sp, "status") }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("assets.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "assets");
    return ok(await openMaintenance(scope, await readJson(request)));
  });
}
