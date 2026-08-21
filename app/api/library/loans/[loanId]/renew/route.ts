// POST /api/library/loans/[loanId]/renew — real auth required; library.manage
// OR the loan's own staff borrower (self-service via Staff.userId).
import type { NextRequest } from "next/server";
import { handle, requireAuth } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { renewLoan } from "@/lib/server/library/loans";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ loanId: string }> }) {
  return handle(async () => {
    const ctx = await requireAuth();
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "library");
    const { loanId } = await params;
    return ok(await renewLoan(scope, loanId, ctx.permissions.has("library.manage")));
  });
}
