// POST /api/counseling/cases/[caseId]/close — server timestamp, never
// reopened. counseling.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { closeCase } from "@/lib/server/counseling/cases";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  return handle(async () => {
    const { caseId } = await params;
    const ctx = await requirePermission("counseling.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "counseling");
    return ok(await closeCase(scope, caseId));
  });
}
