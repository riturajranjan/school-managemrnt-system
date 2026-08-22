// GET  /api/activities/[activityId]/staff — activities.view.
// POST /api/activities/[activityId]/staff — assign a real, active Staff
//      coordinator/coach/mentor. Notifies the staff member's real linked
//      User if one exists. activities.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { assignStaff, listStaffAssignments } from "@/lib/server/activities/staff-assignments";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ activityId: string }> }) {
  return handle(async () => {
    const { activityId } = await params;
    const ctx = await requirePermission("activities.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "activities");
    return ok(await listStaffAssignments(scope, activityId));
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ activityId: string }> }) {
  return handle(async () => {
    const { activityId } = await params;
    const ctx = await requirePermission("activities.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "activities");
    return ok(await assignStaff(scope, activityId, await readJson(request)));
  });
}
