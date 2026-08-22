// GET  /api/activities/[activityId]/members — activities.view.
// POST /api/activities/[activityId]/members — join a real, active Student;
//      concurrency-safe one-active-membership-per-session. activities.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { joinActivity, listMemberships } from "@/lib/server/activities/memberships";

export async function GET(request: NextRequest, { params }: { params: Promise<{ activityId: string }> }) {
  return handle(async () => {
    const { activityId } = await params;
    const ctx = await requirePermission("activities.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "activities");
    const sp = request.nextUrl.searchParams;
    return ok(await listMemberships(scope, { activityId, status: singleParam(sp, "status") }));
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ activityId: string }> }) {
  return handle(async () => {
    const { activityId } = await params;
    const ctx = await requirePermission("activities.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "activities");
    return ok(await joinActivity(scope, activityId, await readJson(request)));
  });
}
