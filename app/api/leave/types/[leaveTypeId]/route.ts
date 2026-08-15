// PATCH /api/leave/types/[leaveTypeId] — edit a leave type. leave.approve.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { updateLeaveType } from "@/lib/server/leave/service";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ leaveTypeId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("leave.approve");
    const scope = await requireOrgScope(ctx);
    const { leaveTypeId } = await params;
    const data = await updateLeaveType(scope, leaveTypeId, await readJson(request));
    return ok(data);
  });
}
