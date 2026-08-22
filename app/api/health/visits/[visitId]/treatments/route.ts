// POST /api/health/visits/[visitId]/treatments — factual first-aid/care
// record, never a prescription. health.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { recordTreatment } from "@/lib/server/health/treatments";

export async function POST(request: NextRequest, { params }: { params: Promise<{ visitId: string }> }) {
  return handle(async () => {
    const { visitId } = await params;
    const ctx = await requirePermission("health.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "health");
    return ok(await recordTreatment(scope, visitId, await readJson(request)));
  });
}
