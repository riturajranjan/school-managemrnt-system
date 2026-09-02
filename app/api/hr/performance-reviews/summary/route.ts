// GET /api/hr/performance-reviews/summary — whole-scope status/rating
// aggregates for the stat tiles, independent of the list's own search/status
// filter and page. hr.view or hr.manage.
import { handle, requireAnyPermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getPerformanceReviewSummary } from "@/lib/server/hr/performance";

export async function GET() {
  return handle(async () => {
    const ctx = await requireAnyPermission(["hr.view", "hr.manage"]);
    const scope = await requireOrgScope(ctx);
    return ok(await getPerformanceReviewSummary(scope));
  });
}
