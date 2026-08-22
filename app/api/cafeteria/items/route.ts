// GET  /api/cafeteria/items — cafeteria.view.
// POST /api/cafeteria/items — cafeteria.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { createItem, listItems } from "@/lib/server/cafeteria/items";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("cafeteria.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "cafeteria");
    const sp = request.nextUrl.searchParams;
    return ok(await listItems(scope, { status: singleParam(sp, "status"), search: singleParam(sp, "search") }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("cafeteria.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "cafeteria");
    return ok(await createItem(scope, await readJson(request)));
  });
}
