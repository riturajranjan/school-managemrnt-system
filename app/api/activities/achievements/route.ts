// GET  /api/activities/achievements — filter: studentId. activities.view.
// POST /api/activities/achievements — record a factual achievement for a
//      real student. Never a score/rank. activities.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { createAchievement, listAchievements } from "@/lib/server/activities/achievements";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("activities.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "activities");
    const sp = request.nextUrl.searchParams;
    return ok(await listAchievements(scope, { studentId: singleParam(sp, "studentId") }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("activities.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "activities");
    return ok(await createAchievement(scope, await readJson(request)));
  });
}
