// POST /api/activities/events/[eventId]/complete — PUBLISHED -> COMPLETED. activities.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { completeEvent } from "@/lib/server/activities/events";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  return handle(async () => {
    const { eventId } = await params;
    const ctx = await requirePermission("activities.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "activities");
    return ok(await completeEvent(scope, eventId));
  });
}
