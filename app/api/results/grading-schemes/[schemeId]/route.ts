// PATCH /api/results/grading-schemes/[schemeId] — rename / archive / restore.
// exams.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { updateGradingScheme } from "@/lib/server/results/grading-service";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ schemeId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("exams.manage");
    const scope = await requireOrgScope(ctx);
    const { schemeId } = await params;
    return ok(await updateGradingScheme(scope, schemeId, await readJson(request)));
  });
}
