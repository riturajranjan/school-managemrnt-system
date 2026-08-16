// GET /api/fees/reports/collection?from=&to= — total/by-method/by-category/by-day. fees.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getFeeCollectionReport } from "@/lib/server/fees/reports";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("fees.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const data = await getFeeCollectionReport(scope, { from: singleParam(sp, "from"), to: singleParam(sp, "to") });
    return ok(data);
  });
}
