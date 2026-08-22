// GET  /api/cafeteria/meals — filters: menuId, studentId, staffId, dateFrom,
//      dateTo, page/pageSize. cafeteria.view.
// POST /api/cafeteria/meals — record meal service to a real, active Student
//      or Staff for a real published menu. cafeteria.serve.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { parsePagination, readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { listMeals, recordMeal } from "@/lib/server/cafeteria/meals";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("cafeteria.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "cafeteria");
    const sp = request.nextUrl.searchParams;
    const { page, pageSize } = parsePagination(sp);
    const { items, total } = await listMeals(scope, {
      menuId: singleParam(sp, "menuId"), studentId: singleParam(sp, "studentId"), staffId: singleParam(sp, "staffId"),
      dateFrom: singleParam(sp, "dateFrom"), dateTo: singleParam(sp, "dateTo"), page, pageSize,
    });
    return ok(items, { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("cafeteria.serve");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "cafeteria");
    return ok(await recordMeal(scope, await readJson(request)));
  });
}
