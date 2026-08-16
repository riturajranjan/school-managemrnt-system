// GET /api/payroll/payslips?period= — every payslip visible to the actor: a
// broad payroll.manage holder sees all in scope; a plain Staff user sees only
// their own (resolved server-side via Staff.userId). Gated by dashboard.view
// (every real role has it) — ownership narrowing happens inside the service.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { listPayslips } from "@/lib/server/payroll/payslips";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("dashboard.view");
    const scope = await requireOrgScope(ctx);
    const period = singleParam(request.nextUrl.searchParams, "period");
    return ok(await listPayslips(scope, { period }));
  });
}
