// POST /api/hostel/leave/:leaveId/approve — hostel.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { approveHostelLeaveRequest } from "@/lib/server/hostel/leave";

export async function POST(request: NextRequest, { params }: { params: Promise<{ leaveId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hostel.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "hostel");
    const { leaveId } = await params;
    return ok(await approveHostelLeaveRequest(scope, leaveId, await readJson(request)));
  });
}
