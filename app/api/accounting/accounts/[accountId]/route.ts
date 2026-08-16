// GET   /api/accounting/accounts/[accountId] — account detail with real balance. accounting.view.
// PATCH /api/accounting/accounts/[accountId] — edit metadata/status. accounting.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getAccountingAccount, updateAccountingAccount } from "@/lib/server/accounting/accounts";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ accountId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("accounting.view");
    const scope = await requireOrgScope(ctx);
    const { accountId } = await params;
    const data = await getAccountingAccount(scope, accountId);
    return ok(data);
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ accountId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("accounting.manage");
    const scope = await requireOrgScope(ctx);
    const { accountId } = await params;
    const data = await updateAccountingAccount(scope, accountId, await readJson(request));
    return ok(data);
  });
}
