// POST /api/counseling/cases/[caseId]/assign — assign a real, active
// counselor Staff member; transitions OPEN/ACTIVE -> ACTIVE. Notifies the
// assigned counselor's real User account if one exists. counseling.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { assignCase } from "@/lib/server/counseling/cases";

export async function POST(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  return handle(async () => {
    const { caseId } = await params;
    const ctx = await requirePermission("counseling.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "counseling");
    return ok(await assignCase(scope, caseId, await readJson(request)));
  });
}
