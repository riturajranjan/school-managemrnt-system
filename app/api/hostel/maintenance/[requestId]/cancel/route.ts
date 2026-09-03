// POST /api/hostel/maintenance/:requestId/cancel — hostel.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { cancelHostelMaintenance } from "@/lib/server/hostel/maintenance";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hostel.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "hostel");
    const { requestId } = await params;
    return ok(await cancelHostelMaintenance(scope, requestId));
  });
}
