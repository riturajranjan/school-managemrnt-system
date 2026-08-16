// GET /api/accounting/trial-balance?asOf= — every account's posted debit/credit/balance. accounting.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getTrialBalance } from "@/lib/server/accounting/ledger";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("accounting.view");
    const scope = await requireOrgScope(ctx);
    const data = await getTrialBalance(scope, { asOf: singleParam(request.nextUrl.searchParams, "asOf") });
    return ok(data);
  });
}
