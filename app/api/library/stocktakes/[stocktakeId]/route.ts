// GET /api/library/stocktakes/[stocktakeId] — full detail incl. scanned and
// missing copy lists. library.view.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getStocktake } from "@/lib/server/library/stocktake";

export async function GET(_request: Request, { params }: { params: Promise<{ stocktakeId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("library.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "library");
    const { stocktakeId } = await params;
    return ok(await getStocktake(scope, stocktakeId));
  });
}
