// GET  /api/payroll/runs?status= — payroll run list. payroll.view.
// POST /api/payroll/runs — create a DRAFT run for a period. payroll.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createPayrollRun, listPayrollRuns } from "@/lib/server/payroll/runs";
import type { PayrollRunStatusDto } from "@/lib/api/contracts";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("payroll.view");
    const scope = await requireOrgScope(ctx);
    const status = singleParam(request.nextUrl.searchParams, "status") as PayrollRunStatusDto | undefined;
    return ok(await listPayrollRuns(scope, { status }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("payroll.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await createPayrollRun(scope, await readJson(request)));
  });
}
