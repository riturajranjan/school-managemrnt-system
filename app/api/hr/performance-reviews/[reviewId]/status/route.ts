// POST /api/hr/performance-reviews/[reviewId]/status { status }
// "archived" is the delete-equivalent — a review is a historical HR record,
// never hard-deleted. hr.manage.
import type { NextRequest } from "next/server";
import { handle, HttpError, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { PERFORMANCE_REVIEW_STATUS_VALUES, setPerformanceReviewStatus } from "@/lib/server/hr/performance";
import type { PerformanceReviewStatusDto } from "@/lib/api/contracts";

export async function POST(request: NextRequest, { params }: { params: Promise<{ reviewId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    const { reviewId } = await params;
    const body = (await readJson(request)) as { status?: unknown };
    if (typeof body.status !== "string" || !(PERFORMANCE_REVIEW_STATUS_VALUES as readonly string[]).includes(body.status)) {
      throw new HttpError("VALIDATION_ERROR", "Invalid status");
    }
    return ok(await setPerformanceReviewStatus(scope, reviewId, body.status as PerformanceReviewStatusDto));
  });
}
