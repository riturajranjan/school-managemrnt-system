// POST /api/payroll/advances/[advanceId]/cancel — APPROVED -> CANCELLED (only before disbursement). payroll.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { cancelStaffFinancialAdvance } from "@/lib/server/payroll/loans-advances";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ advanceId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("payroll.manage");
    const scope = await requireOrgScope(ctx);
    const { advanceId } = await params;
    const data = await cancelStaffFinancialAdvance(scope, "ADVANCE", advanceId);
    return ok(data);
  });
}
