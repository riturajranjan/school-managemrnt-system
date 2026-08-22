// GET /api/hostel/assignments/[assignmentId] — hostel.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getAssignment } from "@/lib/server/hostel/assignments";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hostel.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "hostel");
    const { assignmentId } = await params;
    return ok(await getAssignment(scope, assignmentId));
  });
}
