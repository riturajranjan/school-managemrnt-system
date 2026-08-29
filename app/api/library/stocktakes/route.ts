// GET  /api/library/stocktakes — real stocktake sessions, expected/scanned/
// missing derived live. library.view.
// POST /api/library/stocktakes — start one (at most one IN_PROGRESS per
// school). library.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { listStocktakes, startStocktake } from "@/lib/server/library/stocktake";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("library.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "library");
    return ok(await listStocktakes(scope));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("library.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "library");
    return ok(await startStocktake(scope, await readJson(request)));
  });
}
