// GET   /api/hr/performance-reviews/[reviewId] — hr.view or hr.manage.
// PATCH /api/hr/performance-reviews/[reviewId] — hr.manage.
import type { NextRequest } from "next/server";
import { handle, requireAnyPermission, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getPerformanceReview, updatePerformanceReview } from "@/lib/server/hr/performance";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ reviewId: string }> }) {
  return handle(async () => {
    const ctx = await requireAnyPermission(["hr.view", "hr.manage"]);
    const scope = await requireOrgScope(ctx);
    const { reviewId } = await params;
    return ok(await getPerformanceReview(scope, reviewId));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ reviewId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    const { reviewId } = await params;
    return ok(await updatePerformanceReview(scope, reviewId, await readJson(request)));
  });
}
