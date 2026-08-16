// GET /api/fees/dashboard — collected today/this month, outstanding, overdue. fees.view.
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getFeeDashboard } from "@/lib/server/fees/reports";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("fees.view");
    const scope = await requireOrgScope(ctx);
    const data = await getFeeDashboard(scope);
    return ok(data);
  });
}
