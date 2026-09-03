// GET /api/hostel/complaints/:complaintId — hostel.view.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getHostelComplaint } from "@/lib/server/hostel/complaints";

export async function GET(_request: Request, { params }: { params: Promise<{ complaintId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hostel.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "hostel");
    const { complaintId } = await params;
    return ok(await getHostelComplaint(scope, complaintId));
  });
}
