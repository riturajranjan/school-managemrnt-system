// GET /api/accounting/ledger?accountId=&from=&to= — opening balance, posted
// lines and running balance for one account, fully server-derived. accounting.view.
import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/server/api/response";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { singleParam } from "@/lib/server/api/request";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getAccountLedger } from "@/lib/server/accounting/ledger";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("accounting.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const accountId = singleParam(sp, "accountId");
    if (!accountId) return fail("VALIDATION_ERROR", "`accountId` is required");
    const data = await getAccountLedger(scope, accountId, { from: singleParam(sp, "from"), to: singleParam(sp, "to") });
    return ok(data);
  });
}
