// GET/PATCH /api/health/staff/[staffId]/profile — factual health profile for
// a real, active Staff member. hr.view alone is NOT sufficient — always
// requires health.viewSensitive/health.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getHealthProfileFor, upsertHealthProfileFor } from "@/lib/server/health/profile";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ staffId: string }> }) {
  return handle(async () => {
    const { staffId } = await params;
    const ctx = await requirePermission("health.viewSensitive");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "health");
    return ok(await getHealthProfileFor(scope, { staffId }));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ staffId: string }> }) {
  return handle(async () => {
    const { staffId } = await params;
    const ctx = await requirePermission("health.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "health");
    return ok(await upsertHealthProfileFor(scope, { staffId }, await readJson(request)));
  });
}
