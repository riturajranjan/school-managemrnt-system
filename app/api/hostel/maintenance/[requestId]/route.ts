// GET /api/hostel/maintenance/:requestId — hostel.view.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getHostelMaintenance } from "@/lib/server/hostel/maintenance";

export async function GET(_request: Request, { params }: { params: Promise<{ requestId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hostel.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "hostel");
    const { requestId } = await params;
    return ok(await getHostelMaintenance(scope, requestId));
  });
}
