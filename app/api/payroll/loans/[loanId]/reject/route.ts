// POST /api/payroll/loans/[loanId]/reject — PENDING -> REJECTED. payroll.finalize.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { rejectStaffFinancialAdvance } from "@/lib/server/payroll/loans-advances";

export async function POST(request: NextRequest, { params }: { params: Promise<{ loanId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("payroll.finalize");
    const scope = await requireOrgScope(ctx);
    const { loanId } = await params;
    const data = await rejectStaffFinancialAdvance(scope, "LOAN", loanId, await readJson(request));
    return ok(data);
  });
}
