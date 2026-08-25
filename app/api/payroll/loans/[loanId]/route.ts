// GET   /api/payroll/loans/[loanId] — loan detail with repayment history. payroll.view.
// PATCH /api/payroll/loans/[loanId] — edit while PENDING. payroll.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getStaffFinancialAdvance, updateStaffFinancialAdvance } from "@/lib/server/payroll/loans-advances";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ loanId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("payroll.view");
    const scope = await requireOrgScope(ctx);
    const { loanId } = await params;
    const data = await getStaffFinancialAdvance(scope, "LOAN", loanId);
    return ok(data);
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ loanId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("payroll.manage");
    const scope = await requireOrgScope(ctx);
    const { loanId } = await params;
    const data = await updateStaffFinancialAdvance(scope, "LOAN", loanId, await readJson(request));
    return ok(data);
  });
}
