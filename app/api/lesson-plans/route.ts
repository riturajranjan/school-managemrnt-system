// GET  /api/lesson-plans — list (filters: sectionId, subjectId, staffId,
//      status, dateFrom/dateTo, search, page/pageSize).
// POST /api/lesson-plans — create; CREATE requires the actor's own real
//      TeachingAssignment for (sectionId, subjectId). lessonPlans.view / manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { parsePagination, readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createLessonPlan, listLessonPlans } from "@/lib/server/lesson-plans/service";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("lessonPlans.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const { page, pageSize } = parsePagination(sp);
    const { data, meta } = await listLessonPlans(scope, {
      sectionId: singleParam(sp, "sectionId"),
      subjectId: singleParam(sp, "subjectId"),
      staffId: singleParam(sp, "staffId"),
      status: singleParam(sp, "status"),
      dateFrom: singleParam(sp, "dateFrom"),
      dateTo: singleParam(sp, "dateTo"),
      search: singleParam(sp, "search"),
      page, pageSize,
    });
    return ok(data, meta);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("lessonPlans.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await createLessonPlan(scope, await readJson(request)));
  });
}
