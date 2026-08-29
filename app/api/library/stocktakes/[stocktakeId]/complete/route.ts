// POST /api/library/stocktakes/[stocktakeId]/complete — closes the session.
// library.manage.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { completeStocktake } from "@/lib/server/library/stocktake";

export async function POST(_request: Request, { params }: { params: Promise<{ stocktakeId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("library.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "library");
    const { stocktakeId } = await params;
    return ok(await completeStocktake(scope, stocktakeId));
  });
}
