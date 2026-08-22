// POST /api/health/visits/[visitId]/close — OPEN -> CLOSED. health.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { closeVisit } from "@/lib/server/health/visits";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ visitId: string }> }) {
  return handle(async () => {
    const { visitId } = await params;
    const ctx = await requirePermission("health.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "health");
    return ok(await closeVisit(scope, visitId));
  });
}
