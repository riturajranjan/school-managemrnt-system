// GET /api/lesson-plans/[lessonPlanId] — detail. PATCH — DRAFT/REJECTED only,
// never structural (no section/subject/staff fields exist on the schema).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getLessonPlan, updateLessonPlan } from "@/lib/server/lesson-plans/service";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ lessonPlanId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("lessonPlans.view");
    const scope = await requireOrgScope(ctx);
    const { lessonPlanId } = await params;
    return ok(await getLessonPlan(scope, lessonPlanId));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ lessonPlanId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("lessonPlans.manage");
    const scope = await requireOrgScope(ctx);
    const { lessonPlanId } = await params;
    return ok(await updateLessonPlan(scope, lessonPlanId, await readJson(request)));
  });
}
