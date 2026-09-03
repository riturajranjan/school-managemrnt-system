// GET /api/hostel/leave/:leaveId — leave request detail. hostel.view.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getHostelLeaveRequest } from "@/lib/server/hostel/leave";

export async function GET(_request: Request, { params }: { params: Promise<{ leaveId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hostel.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "hostel");
    const { leaveId } = await params;
    return ok(await getHostelLeaveRequest(scope, leaveId));
  });
}
