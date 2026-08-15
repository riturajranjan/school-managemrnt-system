// POST /api/leave/requests/[leaveRequestId]/approve — broad-manager only. leave.approve.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { approveLeaveRequest } from "@/lib/server/leave/service";

export async function POST(_request: Request, { params }: { params: Promise<{ leaveRequestId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("leave.approve");
    const scope = await requireOrgScope(ctx);
    const { leaveRequestId } = await params;
    const data = await approveLeaveRequest(scope, leaveRequestId);
    return ok(data);
  });
}
