// GET /api/leave/requests/[leaveRequestId] — own request, or any when the
// actor is a broad leave manager (enforced inside the service).
import { handle, requireAnyPermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getLeaveRequest } from "@/lib/server/leave/service";

export async function GET(_request: Request, { params }: { params: Promise<{ leaveRequestId: string }> }) {
  return handle(async () => {
    const ctx = await requireAnyPermission(["leave.submit", "leave.approve"]);
    const scope = await requireOrgScope(ctx);
    const { leaveRequestId } = await params;
    const data = await getLeaveRequest(scope, leaveRequestId);
    return ok(data);
  });
}
