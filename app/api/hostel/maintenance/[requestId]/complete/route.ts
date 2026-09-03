// POST /api/hostel/maintenance/:requestId/complete — hostel.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { completeHostelMaintenance } from "@/lib/server/hostel/maintenance";

export async function POST(request: NextRequest, { params }: { params: Promise<{ requestId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hostel.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "hostel");
    const { requestId } = await params;
    return ok(await completeHostelMaintenance(scope, requestId, await readJson(request)));
  });
}
