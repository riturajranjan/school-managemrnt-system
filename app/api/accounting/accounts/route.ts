// GET  /api/accounting/accounts?type=&status=&search= — chart of accounts with real balances. accounting.view.
// POST /api/accounting/accounts — create an account. accounting.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createAccountingAccount, listAccountingAccounts } from "@/lib/server/accounting/accounts";
import type { AccountingAccountTypeDto } from "@/lib/api/contracts";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("accounting.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const data = await listAccountingAccounts(scope, {
      type: singleParam(sp, "type") as AccountingAccountTypeDto | undefined,
      status: singleParam(sp, "status") as "active" | "archived" | undefined,
      search: singleParam(sp, "search"),
    });
    return ok(data);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("accounting.manage");
    const scope = await requireOrgScope(ctx);
    const data = await createAccountingAccount(scope, await readJson(request));
    return ok(data);
  });
}
