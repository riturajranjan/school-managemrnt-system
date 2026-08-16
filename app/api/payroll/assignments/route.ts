// GET  /api/payroll/assignments?staffId= — effective-dated assignment history. payroll.view.
// POST /api/payroll/assignments — assign a staff member to a salary structure. payroll.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createStaffSalaryAssignment, listStaffSalaryAssignments } from "@/lib/server/payroll/assignments";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("payroll.view");
    const scope = await requireOrgScope(ctx);
    const staffId = singleParam(request.nextUrl.searchParams, "staffId");
    return ok(await listStaffSalaryAssignments(scope, { staffId }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("payroll.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await createStaffSalaryAssignment(scope, await readJson(request)));
  });
}
