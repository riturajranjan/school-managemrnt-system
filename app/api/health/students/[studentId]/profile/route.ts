// GET/PATCH /api/health/students/[studentId]/profile — factual health
// profile for a real, active Student. Reading or writing a profile always
// requires health.viewSensitive/health.manage — no non-sensitive subset.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getHealthProfileFor, upsertHealthProfileFor } from "@/lib/server/health/profile";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  return handle(async () => {
    const { studentId } = await params;
    const ctx = await requirePermission("health.viewSensitive");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "health");
    return ok(await getHealthProfileFor(scope, { studentId }));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  return handle(async () => {
    const { studentId } = await params;
    const ctx = await requirePermission("health.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "health");
    return ok(await upsertHealthProfileFor(scope, { studentId }, await readJson(request)));
  });
}
