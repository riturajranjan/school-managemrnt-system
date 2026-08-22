// GET   /api/health/visits/[visitId] — full detail (vitals/treatments/
//       medications included only when the caller holds health.viewSensitive).
//       health.view.
// PATCH /api/health/visits/[visitId] — edit an OPEN visit's factual fields.
//       health.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getVisitDetail, updateVisit } from "@/lib/server/health/visits";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ visitId: string }> }) {
  return handle(async () => {
    const { visitId } = await params;
    const ctx = await requirePermission("health.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "health");
    const sensitive = ctx.permissions.has("health.viewSensitive");
    return ok(await getVisitDetail(scope, visitId, sensitive));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ visitId: string }> }) {
  return handle(async () => {
    const { visitId } = await params;
    const ctx = await requirePermission("health.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "health");
    return ok(await updateVisit(scope, visitId, await readJson(request)));
  });
}
