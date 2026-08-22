// GET /api/activities/events — flat list across all activities. Filters:
// activityId, status, upcoming, dateFrom, dateTo. activities.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { listEvents } from "@/lib/server/activities/events";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("activities.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "activities");
    const sp = request.nextUrl.searchParams;
    return ok(await listEvents(scope, {
      activityId: singleParam(sp, "activityId"), status: singleParam(sp, "status"), upcoming: sp.get("upcoming") === "true",
      dateFrom: singleParam(sp, "dateFrom"), dateTo: singleParam(sp, "dateTo"),
    }));
  });
}
