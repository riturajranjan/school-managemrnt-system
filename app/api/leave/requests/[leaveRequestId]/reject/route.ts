// POST /api/leave/requests/[leaveRequestId]/reject — broad-manager only. leave.approve.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { rejectLeaveRequest } from "@/lib/server/leave/service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ leaveRequestId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("leave.approve");
    const scope = await requireOrgScope(ctx);
    const { leaveRequestId } = await params;
    const data = await rejectLeaveRequest(scope, leaveRequestId, await readJson(request));
    return ok(data);
  });
}
