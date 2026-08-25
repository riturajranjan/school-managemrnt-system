// POST /api/payroll/advances/[advanceId]/reject — PENDING -> REJECTED. payroll.finalize.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { rejectStaffFinancialAdvance } from "@/lib/server/payroll/loans-advances";

export async function POST(request: NextRequest, { params }: { params: Promise<{ advanceId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("payroll.finalize");
    const scope = await requireOrgScope(ctx);
    const { advanceId } = await params;
    const data = await rejectStaffFinancialAdvance(scope, "ADVANCE", advanceId, await readJson(request));
    return ok(data);
  });
}
