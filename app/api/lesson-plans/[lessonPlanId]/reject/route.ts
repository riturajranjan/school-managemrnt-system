// POST /api/lesson-plans/[lessonPlanId]/reject — { comment } — SUBMITTED ->
// REJECTED. Broad-manager only (SCHOOL_ADMIN/PRINCIPAL).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { rejectLessonPlan } from "@/lib/server/lesson-plans/service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ lessonPlanId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("lessonPlans.manage");
    const scope = await requireOrgScope(ctx);
    const { lessonPlanId } = await params;
    return ok(await rejectLessonPlan(scope, lessonPlanId, await readJson(request)));
  });
}
