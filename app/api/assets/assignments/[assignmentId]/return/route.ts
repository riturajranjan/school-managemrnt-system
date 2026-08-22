// POST /api/assets/assignments/[assignmentId]/return — server-authoritative
// return timestamp; duplicate returns rejected. assets.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { returnAsset } from "@/lib/server/assets/assignments";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ assignmentId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("assets.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "assets");
    const { assignmentId } = await params;
    return ok(await returnAsset(scope, assignmentId));
  });
}
