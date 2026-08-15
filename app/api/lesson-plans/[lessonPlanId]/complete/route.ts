// POST /api/lesson-plans/[lessonPlanId]/complete — APPROVED -> COMPLETED.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { completeLessonPlan } from "@/lib/server/lesson-plans/service";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ lessonPlanId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("lessonPlans.manage");
    const scope = await requireOrgScope(ctx);
    const { lessonPlanId } = await params;
    return ok(await completeLessonPlan(scope, lessonPlanId));
  });
}
