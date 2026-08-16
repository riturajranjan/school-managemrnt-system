// GET  /api/payroll/components?status= — salary components. payroll.view.
// POST /api/payroll/components — create a component. payroll.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createSalaryComponent, listSalaryComponents } from "@/lib/server/payroll/components";
import type { SalaryComponentStatusDto } from "@/lib/api/contracts";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("payroll.view");
    const scope = await requireOrgScope(ctx);
    const status = singleParam(request.nextUrl.searchParams, "status") as SalaryComponentStatusDto | undefined;
    return ok(await listSalaryComponents(scope, { status }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("payroll.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await createSalaryComponent(scope, await readJson(request)));
  });
}
