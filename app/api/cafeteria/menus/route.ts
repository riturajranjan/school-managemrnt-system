// GET  /api/cafeteria/menus — filters: locationId, date, dateFrom, dateTo,
//      mealType. cafeteria.view.
// POST /api/cafeteria/menus — create a menu for one serving slot; rejects a
//      duplicate (locationId, date, mealType). cafeteria.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { createMenu, listMenus } from "@/lib/server/cafeteria/menus";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("cafeteria.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "cafeteria");
    const sp = request.nextUrl.searchParams;
    return ok(await listMenus(scope, {
      locationId: singleParam(sp, "locationId"), date: singleParam(sp, "date"),
      dateFrom: singleParam(sp, "dateFrom"), dateTo: singleParam(sp, "dateTo"), mealType: singleParam(sp, "mealType"),
    }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("cafeteria.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "cafeteria");
    return ok(await createMenu(scope, await readJson(request)));
  });
}
