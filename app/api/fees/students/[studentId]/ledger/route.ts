// GET /api/fees/students/[studentId]/ledger — assignments, charges, payments, totals. fees.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getStudentFeeLedger } from "@/lib/server/fees/dues";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("fees.view");
    const scope = await requireOrgScope(ctx);
    const { studentId } = await params;
    const data = await getStudentFeeLedger(scope, studentId);
    return ok(data);
  });
}
