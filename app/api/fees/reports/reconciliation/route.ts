// GET /api/fees/reports/reconciliation — unreconciled/reconciled/mismatch counts + amount. fees.view.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getFeeReconciliationReport } from "@/lib/server/fees/reports";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("fees.view");
    const scope = await requireOrgScope(ctx);
    const data = await getFeeReconciliationReport(scope);
    return ok(data);
  });
}
