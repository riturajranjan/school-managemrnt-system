// GET /api/library/loans/[loanId] — library.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getLoan } from "@/lib/server/library/loans";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ loanId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("library.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "library");
    const { loanId } = await params;
    return ok(await getLoan(scope, loanId));
  });
}
