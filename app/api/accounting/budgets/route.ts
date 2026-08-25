// GET  /api/accounting/budgets — list budgets with live budgeted/actual/variance. accounting.view.
// POST /api/accounting/budgets — create a DRAFT budget with account allocations. accounting.manage.
// Never writes a JournalEntry — actual is always derived from the real ledger, never persisted here.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createBudget, listBudgets } from "@/lib/server/accounting/budgets";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("accounting.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const page = singleParam(sp, "page"), pageSize = singleParam(sp, "pageSize");
    const { data, meta } = await listBudgets(scope, {
      status: singleParam(sp, "status"),
      page: page ? Number(page) : undefined, pageSize: pageSize ? Number(pageSize) : undefined,
    });
    return ok(data, meta);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("accounting.manage");
    const scope = await requireOrgScope(ctx);
    const data = await createBudget(scope, await readJson(request));
    return ok(data);
  });
}
