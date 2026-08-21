// POST /api/library/loans/[loanId]/return — library.manage. Duplicate
// return -> 409 CONFLICT.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { returnLoan } from "@/lib/server/library/loans";

export async function POST(request: NextRequest, { params }: { params: Promise<{ loanId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("library.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "library");
    const { loanId } = await params;
    return ok(await returnLoan(scope, loanId, await readJson(request)));
  });
}
