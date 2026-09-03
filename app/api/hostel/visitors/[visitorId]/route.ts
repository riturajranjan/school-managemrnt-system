// GET /api/hostel/visitors/:visitorId — hostel.view.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getHostelVisitor } from "@/lib/server/hostel/visitors";

export async function GET(_request: Request, { params }: { params: Promise<{ visitorId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hostel.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "hostel");
    const { visitorId } = await params;
    return ok(await getHostelVisitor(scope, visitorId));
  });
}
