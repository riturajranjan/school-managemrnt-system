// GET /api/payroll/payslips/[itemId] — a single frozen payslip snapshot.
// A broad payroll.manage holder may view any; a plain Staff user may ONLY
// view their own (404 otherwise) — see lib/server/payroll/payslips.ts.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getPayslip } from "@/lib/server/payroll/payslips";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("dashboard.view");
    const scope = await requireOrgScope(ctx);
    const { itemId } = await params;
    return ok(await getPayslip(scope, itemId));
  });
}
