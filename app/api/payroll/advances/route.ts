// GET  /api/payroll/advances — list/filter staff advances. payroll.view.
// POST /api/payroll/advances — request a new advance (PENDING). payroll.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createStaffFinancialAdvance, listStaffFinancialAdvances } from "@/lib/server/payroll/loans-advances";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("payroll.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const page = singleParam(sp, "page"), pageSize = singleParam(sp, "pageSize");
    const { data, meta } = await listStaffFinancialAdvances(scope, "ADVANCE", {
      status: singleParam(sp, "status"), staffId: singleParam(sp, "staffId"),
      page: page ? Number(page) : undefined, pageSize: pageSize ? Number(pageSize) : undefined,
    });
    return ok(data, meta);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("payroll.manage");
    const scope = await requireOrgScope(ctx);
    const data = await createStaffFinancialAdvance(scope, "ADVANCE", await readJson(request));
    return ok(data);
  });
}
