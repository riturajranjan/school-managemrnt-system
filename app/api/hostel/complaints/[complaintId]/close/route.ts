// POST /api/hostel/complaints/:complaintId/close — hostel.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { closeHostelComplaint } from "@/lib/server/hostel/complaints";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ complaintId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hostel.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "hostel");
    const { complaintId } = await params;
    return ok(await closeHostelComplaint(scope, complaintId));
  });
}
