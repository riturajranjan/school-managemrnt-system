// GET  /api/health/visits — list (filters: studentId, staffId, status,
//      page/pageSize). Sensitive fields (reason/notes/careAction/referral
//      text) are redacted to null unless the caller holds health.viewSensitive.
//      health.view.
// POST /api/health/visits — record a new visit for a real, active Student or
//      Staff patient. health.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { parsePagination, readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { createVisit, listVisits } from "@/lib/server/health/visits";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("health.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "health");
    const sensitive = ctx.permissions.has("health.viewSensitive");
    const sp = request.nextUrl.searchParams;
    const { page, pageSize } = parsePagination(sp);
    const { items, total } = await listVisits(scope, sensitive, {
      studentId: singleParam(sp, "studentId"), staffId: singleParam(sp, "staffId"), status: singleParam(sp, "status"), page, pageSize,
    });
    return ok(items, { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("health.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "health");
    return ok(await createVisit(scope, await readJson(request)));
  });
}
