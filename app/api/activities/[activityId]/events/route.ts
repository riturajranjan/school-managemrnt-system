// GET  /api/activities/[activityId]/events — activities.view.
// POST /api/activities/[activityId]/events — create a DRAFT event. activities.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { createEvent, listEvents } from "@/lib/server/activities/events";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ activityId: string }> }) {
  return handle(async () => {
    const { activityId } = await params;
    const ctx = await requirePermission("activities.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "activities");
    return ok(await listEvents(scope, { activityId }));
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ activityId: string }> }) {
  return handle(async () => {
    const { activityId } = await params;
    const ctx = await requirePermission("activities.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "activities");
    const body = (await readJson(request)) as Record<string, unknown>;
    return ok(await createEvent(scope, { ...body, activityId }));
  });
}
