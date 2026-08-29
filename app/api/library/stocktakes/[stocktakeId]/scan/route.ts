// POST /api/library/stocktakes/[stocktakeId]/scan { code } — real scan
// against LibraryBookCopy by barcode or accession number. library.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { scanStocktakeItem } from "@/lib/server/library/stocktake";

export async function POST(request: NextRequest, { params }: { params: Promise<{ stocktakeId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("library.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "library");
    const { stocktakeId } = await params;
    return ok(await scanStocktakeItem(scope, stocktakeId, await readJson(request)));
  });
}
