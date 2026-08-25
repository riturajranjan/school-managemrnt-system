// GET /api/accounting/budgets/[budgetId] — budget detail with live per-account budgeted/actual/variance. accounting.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getBudget } from "@/lib/server/accounting/budgets";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ budgetId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("accounting.view");
    const scope = await requireOrgScope(ctx);
    const { budgetId } = await params;
    const data = await getBudget(scope, budgetId);
    return ok(data);
  });
}
