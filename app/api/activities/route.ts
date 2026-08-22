// GET  /api/activities — activities.view.
// POST /api/activities — activities.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { createActivity, listActivities } from "@/lib/server/activities/activities";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("activities.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "activities");
    const sp = request.nextUrl.searchParams;
    return ok(await listActivities(scope, { type: singleParam(sp, "type"), status: singleParam(sp, "status"), search: singleParam(sp, "search") }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("activities.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "activities");
    return ok(await createActivity(scope, await readJson(request)));
  });
}
