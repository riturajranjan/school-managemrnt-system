// POST /api/hostel/visitors/:visitorId/check-in — hostel.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { checkInHostelVisitor } from "@/lib/server/hostel/visitors";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ visitorId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hostel.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "hostel");
    const { visitorId } = await params;
    return ok(await checkInHostelVisitor(scope, visitorId));
  });
}
