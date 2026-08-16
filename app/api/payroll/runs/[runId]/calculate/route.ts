// POST /api/payroll/runs/[runId]/calculate — (re)generate PayrollRunItem snapshots. payroll.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { calculatePayrollRun } from "@/lib/server/payroll/runs";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("payroll.manage");
    const scope = await requireOrgScope(ctx);
    const { runId } = await params;
    return ok(await calculatePayrollRun(scope, runId));
  });
}
