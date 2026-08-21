// GET /api/library/loans/mine — the authenticated staff borrower's own
// loans, resolved via Staff.userId. No library.* permission required.
import { handle, requireAuth } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { listMyLoans } from "@/lib/server/library/loans";

export async function GET() {
  return handle(async () => {
    const ctx = await requireAuth();
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "library");
    return ok(await listMyLoans(scope));
  });
}
