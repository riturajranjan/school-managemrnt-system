// GET /api/payroll/runs/[runId] — run detail with items + staff-without-assignment. payroll.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getPayrollRun } from "@/lib/server/payroll/runs";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("payroll.view");
    const scope = await requireOrgScope(ctx);
    const { runId } = await params;
    return ok(await getPayrollRun(scope, runId));
  });
}
