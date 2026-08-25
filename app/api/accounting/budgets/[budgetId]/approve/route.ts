// POST /api/accounting/budgets/[budgetId]/approve — DRAFT -> APPROVED. accounting.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { approveBudget } from "@/lib/server/accounting/budgets";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ budgetId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("accounting.manage");
    const scope = await requireOrgScope(ctx);
    const { budgetId } = await params;
    const data = await approveBudget(scope, budgetId);
    return ok(data);
  });
}
