// GET /api/fees/reports/outstanding — total + class-wise outstanding/overdue. fees.view.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getFeeOutstandingReport } from "@/lib/server/fees/reports";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("fees.view");
    const scope = await requireOrgScope(ctx);
    const data = await getFeeOutstandingReport(scope);
    return ok(data);
  });
}
