// GET  /api/hr/performance-reviews — hr.view or hr.manage (whole-directory read).
// POST /api/hr/performance-reviews — hr.manage. Reviewer is validated server-
// side against a real, active, in-school Staff record (never trusted from
// the browser as authorization).
import type { NextRequest } from "next/server";
import { handle, requireAnyPermission, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createPerformanceReview, listPerformanceReviews } from "@/lib/server/hr/performance";
import type { PerformanceReviewStatusDto } from "@/lib/api/contracts";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requireAnyPermission(["hr.view", "hr.manage"]);
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    return ok(
      await listPerformanceReviews(scope, {
        staffId: singleParam(sp, "staffId"),
        status: singleParam(sp, "status") as PerformanceReviewStatusDto | undefined,
      }),
    );
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await createPerformanceReview(scope, await readJson(request)));
  });
}
