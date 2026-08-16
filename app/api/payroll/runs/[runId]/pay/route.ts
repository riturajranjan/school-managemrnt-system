// POST /api/payroll/runs/[runId]/pay — record whole-run payment + post the real Accounting journal. payroll.pay.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { recordPayrollPayment } from "@/lib/server/payroll/payments";

export async function POST(request: NextRequest, { params }: { params: Promise<{ runId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("payroll.pay");
    const scope = await requireOrgScope(ctx);
    const { runId } = await params;
    return ok(await recordPayrollPayment(scope, runId, await readJson(request)));
  });
}
