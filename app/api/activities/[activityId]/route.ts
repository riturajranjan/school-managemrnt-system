// GET/PATCH /api/activities/[activityId]. GET: activities.view. PATCH: activities.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getActivity, updateActivity } from "@/lib/server/activities/activities";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ activityId: string }> }) {
  return handle(async () => {
    const { activityId } = await params;
    const ctx = await requirePermission("activities.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "activities");
    return ok(await getActivity(scope, activityId));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ activityId: string }> }) {
  return handle(async () => {
    const { activityId } = await params;
    const ctx = await requirePermission("activities.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "activities");
    return ok(await updateActivity(scope, activityId, await readJson(request)));
  });
}
