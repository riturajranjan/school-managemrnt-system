// GET /api/accounting/dashboard — month-to-date income/expense, cash/bank
// balance, unreconciled Fee collections, recent journals, trial-balance
// integrity. accounting.view.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getAccountingDashboard } from "@/lib/server/accounting/reports";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("accounting.view");
    const scope = await requireOrgScope(ctx);
    const data = await getAccountingDashboard(scope);
    return ok(data);
  });
}
