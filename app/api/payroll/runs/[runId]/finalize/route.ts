// POST /api/payroll/runs/[runId]/finalize — lock the run's snapshot, immutable after. payroll.finalize.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { finalizePayrollRun } from "@/lib/server/payroll/runs";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("payroll.finalize");
    const scope = await requireOrgScope(ctx);
    const { runId } = await params;
    return ok(await finalizePayrollRun(scope, runId));
  });
}
