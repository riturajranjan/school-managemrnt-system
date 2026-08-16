// GET /api/accounting/reports/income-expense?from=&to= — ledger-derived, not fee-mock-derived. accounting.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getIncomeExpenseReport } from "@/lib/server/accounting/reports";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("accounting.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const data = await getIncomeExpenseReport(scope, { from: singleParam(sp, "from"), to: singleParam(sp, "to") });
    return ok(data);
  });
}
