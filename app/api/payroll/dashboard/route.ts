// GET /api/payroll/dashboard — real, ledger/run-derived KPIs. payroll.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getPayrollDashboard } from "@/lib/server/payroll/reports";

export async function GET(_request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("payroll.view");
    const scope = await requireOrgScope(ctx);
    return ok(await getPayrollDashboard(scope));
  });
}
