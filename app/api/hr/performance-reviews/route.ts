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

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requireAnyPermission(["hr.view", "hr.manage"]);
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const page = singleParam(sp, "page"), pageSize = singleParam(sp, "pageSize");
    const { data, meta } = await listPerformanceReviews(scope, {
      staffId: singleParam(sp, "staffId"),
      reviewerId: singleParam(sp, "reviewerId"),
      status: singleParam(sp, "status"),
      search: singleParam(sp, "search"),
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
    return ok(data, meta);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await createPerformanceReview(scope, await readJson(request)));
  });
}
