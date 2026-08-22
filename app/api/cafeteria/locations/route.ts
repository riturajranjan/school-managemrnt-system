// GET  /api/cafeteria/locations — cafeteria.view.
// POST /api/cafeteria/locations — cafeteria.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { createLocation, listLocations } from "@/lib/server/cafeteria/locations";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("cafeteria.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "cafeteria");
    const sp = request.nextUrl.searchParams;
    return ok(await listLocations(scope, { status: singleParam(sp, "status") }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("cafeteria.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "cafeteria");
    return ok(await createLocation(scope, await readJson(request)));
  });
}
