// GET   /api/counseling/cases/[caseId] — case metadata. counseling.view.
// PATCH /api/counseling/cases/[caseId] — edit factual metadata (concern
//       category, summary, follow-up date) while not closed. counseling.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getCase, updateCase } from "@/lib/server/counseling/cases";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  return handle(async () => {
    const { caseId } = await params;
    const ctx = await requirePermission("counseling.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "counseling");
    return ok(await getCase(scope, caseId));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  return handle(async () => {
    const { caseId } = await params;
    const ctx = await requirePermission("counseling.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "counseling");
    return ok(await updateCase(scope, caseId, await readJson(request)));
  });
}
