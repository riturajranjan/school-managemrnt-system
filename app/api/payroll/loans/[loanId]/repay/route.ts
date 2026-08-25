// POST /api/payroll/loans/[loanId]/repay — record a manual repayment (partial or final). payroll.pay.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { recordStaffFinancialAdvanceRepayment } from "@/lib/server/payroll/loans-advances";

export async function POST(request: NextRequest, { params }: { params: Promise<{ loanId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("payroll.pay");
    const scope = await requireOrgScope(ctx);
    const { loanId } = await params;
    const data = await recordStaffFinancialAdvanceRepayment(scope, "LOAN", loanId, await readJson(request));
    return ok(data);
  });
}
