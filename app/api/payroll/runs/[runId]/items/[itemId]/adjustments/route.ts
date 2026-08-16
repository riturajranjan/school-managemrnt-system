// POST /api/payroll/runs/[runId]/items/[itemId]/adjustments — a generic manual
// earning/deduction line (bonus, allowance, extra deduction, reimbursement)
// against one staff member's snapshot. Blocked once FINALIZED. payroll.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { addManualPayrollAdjustment } from "@/lib/server/payroll/runs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ runId: string; itemId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("payroll.manage");
    const scope = await requireOrgScope(ctx);
    const { runId, itemId } = await params;
    return ok(await addManualPayrollAdjustment(scope, runId, itemId, await readJson(request)));
  });
}
