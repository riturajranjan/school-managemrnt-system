// DELETE /api/activities/[activityId]/staff/[assignmentId] — end an active
// staff assignment. activities.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { endStaffAssignment } from "@/lib/server/activities/staff-assignments";

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ activityId: string; assignmentId: string }> }) {
  return handle(async () => {
    const { activityId, assignmentId } = await params;
    const ctx = await requirePermission("activities.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "activities");
    return ok(await endStaffAssignment(scope, activityId, assignmentId));
  });
}
