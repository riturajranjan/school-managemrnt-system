// GET /api/fees/reports/adjustments?kind=discount|scholarship|late_fee — totals. fees.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { fail, ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getFeeAdjustmentReport } from "@/lib/server/fees/reports";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("fees.view");
    const scope = await requireOrgScope(ctx);
    const kind = request.nextUrl.searchParams.get("kind");
    if (kind !== "discount" && kind !== "scholarship" && kind !== "late_fee") return fail("VALIDATION_ERROR", "`kind` must be discount, scholarship or late_fee");
    const data = await getFeeAdjustmentReport(scope, kind);
    return ok(data);
  });
}
