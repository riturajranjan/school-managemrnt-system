// GET /api/payroll/reports?year= — earnings/deductions breakdown from FINALIZED/PAID runs only. payroll.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getPayrollEarningsDeductionsReport } from "@/lib/server/payroll/reports";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("payroll.view");
    const scope = await requireOrgScope(ctx);
    const yearParam = singleParam(request.nextUrl.searchParams, "year");
    return ok(await getPayrollEarningsDeductionsReport(scope, { year: yearParam ? Number(yearParam) : undefined }));
  });
}
