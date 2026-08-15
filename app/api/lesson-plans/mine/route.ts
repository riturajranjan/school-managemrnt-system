// GET /api/lesson-plans/mine — the caller's own lesson plans, real Staff.id
// resolved server-side. Empty (not an error) for anyone with no real teaching
// Staff profile. lessonPlans.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { parsePagination, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { listMyLessonPlans } from "@/lib/server/lesson-plans/service";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("lessonPlans.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const { page, pageSize } = parsePagination(sp);
    const { data, meta } = await listMyLessonPlans(scope, {
      status: singleParam(sp, "status"),
      search: singleParam(sp, "search"),
      page, pageSize,
    });
    return ok(data, meta);
  });
}
