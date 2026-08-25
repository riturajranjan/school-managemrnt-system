// GET   /api/payroll/advances/[advanceId] — advance detail with repayment history. payroll.view.
// PATCH /api/payroll/advances/[advanceId] — edit while PENDING. payroll.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getStaffFinancialAdvance, updateStaffFinancialAdvance } from "@/lib/server/payroll/loans-advances";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ advanceId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("payroll.view");
    const scope = await requireOrgScope(ctx);
    const { advanceId } = await params;
    const data = await getStaffFinancialAdvance(scope, "ADVANCE", advanceId);
    return ok(data);
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ advanceId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("payroll.manage");
    const scope = await requireOrgScope(ctx);
    const { advanceId } = await params;
    const data = await updateStaffFinancialAdvance(scope, "ADVANCE", advanceId, await readJson(request));
    return ok(data);
  });
}
