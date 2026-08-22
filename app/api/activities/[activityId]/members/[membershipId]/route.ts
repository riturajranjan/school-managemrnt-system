// DELETE /api/activities/[activityId]/members/[membershipId] — close an
// active membership (leave). activities.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { leaveActivity } from "@/lib/server/activities/memberships";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ activityId: string; membershipId: string }> }) {
  return handle(async () => {
    const { activityId, membershipId } = await params;
    const ctx = await requirePermission("activities.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "activities");
    return ok(await leaveActivity(scope, activityId, membershipId));
  });
}
