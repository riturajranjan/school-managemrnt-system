// GET /api/assets/assignments — assets.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { listAssignments } from "@/lib/server/assets/assignments";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("assets.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "assets");
    const sp = request.nextUrl.searchParams;
    const status = singleParam(sp, "status");
    return ok(await listAssignments(scope, { assetId: singleParam(sp, "assetId"), staffId: singleParam(sp, "staffId"), status: status === "active" || status === "returned" ? status : undefined }));
  });
}
