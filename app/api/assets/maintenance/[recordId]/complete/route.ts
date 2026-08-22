// POST /api/assets/maintenance/[recordId]/complete — closes the record
// (completed/cancelled) and returns the asset to AVAILABLE. assets.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { completeMaintenance } from "@/lib/server/assets/maintenance";

export async function POST(request: NextRequest, { params }: { params: Promise<{ recordId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("assets.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "assets");
    const { recordId } = await params;
    return ok(await completeMaintenance(scope, recordId, await readJson(request)));
  });
}
