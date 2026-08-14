// PUT /api/results/grading-schemes/[schemeId]/bands — atomic full-replace of a
// scheme's grade bands (validated as one complete set first). exams.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { reconcileGradingBands } from "@/lib/server/results/grading-service";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ schemeId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("exams.manage");
    const scope = await requireOrgScope(ctx);
    const { schemeId } = await params;
    return ok(await reconcileGradingBands(scope, schemeId, await readJson(request)));
  });
}
