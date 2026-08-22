// GET/PATCH /api/activities/events/[eventId]. GET: activities.view. PATCH:
// activities.manage (rejects editing a COMPLETED/CANCELLED event).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getEvent, updateEvent } from "@/lib/server/activities/events";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  return handle(async () => {
    const { eventId } = await params;
    const ctx = await requirePermission("activities.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "activities");
    return ok(await getEvent(scope, eventId));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  return handle(async () => {
    const { eventId } = await params;
    const ctx = await requirePermission("activities.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "activities");
    return ok(await updateEvent(scope, eventId, await readJson(request)));
  });
}
