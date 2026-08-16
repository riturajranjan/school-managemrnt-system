// GET  /api/payroll/structures?status= — salary structures. payroll.view.
// POST /api/payroll/structures — create a structure with component lines. payroll.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createSalaryStructure, listSalaryStructures } from "@/lib/server/payroll/structures";
import type { SalaryStructureStatusDto } from "@/lib/api/contracts";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("payroll.view");
    const scope = await requireOrgScope(ctx);
    const status = singleParam(request.nextUrl.searchParams, "status") as SalaryStructureStatusDto | undefined;
    return ok(await listSalaryStructures(scope, { status }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("payroll.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await createSalaryStructure(scope, await readJson(request)));
  });
}
