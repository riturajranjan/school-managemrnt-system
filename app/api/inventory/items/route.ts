// GET  /api/inventory/items — real item catalog. inventory.view.
// POST /api/inventory/items — create an item (+ optional opening stock). inventory.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { createItem, listItems } from "@/lib/server/inventory/items";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("inventory.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "inventory");
    const sp = request.nextUrl.searchParams;
    return ok(await listItems(scope, { search: singleParam(sp, "search"), status: singleParam(sp, "status"), category: singleParam(sp, "category") }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("inventory.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "inventory");
    return ok(await createItem(scope, await readJson(request)));
  });
}
