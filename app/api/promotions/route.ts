// GET /api/promotions — promotion history for the school, filterable and
// paginated. promotion.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { parsePagination, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { listPromotions } from "@/lib/server/promotion/service";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("promotion.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const { page, pageSize } = parsePagination(sp);
    const { data, meta } = await listPromotions(scope, {
      fromAcademicSessionId: singleParam(sp, "fromAcademicSessionId"),
      toAcademicSessionId: singleParam(sp, "toAcademicSessionId"),
      examId: singleParam(sp, "examId"),
      targetClassId: singleParam(sp, "targetClassId"),
      targetSectionId: singleParam(sp, "targetSectionId"),
      decision: singleParam(sp, "decision"),
      search: singleParam(sp, "search"),
      page,
      pageSize,
    });
    return ok(data, meta);
  });
}
