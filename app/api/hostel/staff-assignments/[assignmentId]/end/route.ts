// POST /api/hostel/staff-assignments/[assignmentId]/end — hostel.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { endHostelStaffAssignment } from "@/lib/server/hostel/staff-assignments";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hostel.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "hostel");
    const { assignmentId } = await params;
    return ok(await endHostelStaffAssignment(scope, assignmentId));
  });
}
