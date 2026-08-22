// GET /api/counseling/sessions/[sessionId] — session metadata only (no
// confidential notes). counseling.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getSessionDto } from "@/lib/server/counseling/sessions";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  return handle(async () => {
    const { sessionId } = await params;
    const ctx = await requirePermission("counseling.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "counseling");
    return ok(await getSessionDto(scope, sessionId));
  });
}
