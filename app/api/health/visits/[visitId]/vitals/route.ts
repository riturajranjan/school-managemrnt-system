// POST /api/health/visits/[visitId]/vitals — record measurements only, never
// an interpretation/diagnosis. health.manage (recording is itself sensitive
// clinical activity, gated the same as viewing).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { recordVitals } from "@/lib/server/health/vitals";

export async function POST(request: NextRequest, { params }: { params: Promise<{ visitId: string }> }) {
  return handle(async () => {
    const { visitId } = await params;
    const ctx = await requirePermission("health.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "health");
    return ok(await recordVitals(scope, visitId, await readJson(request)));
  });
}
