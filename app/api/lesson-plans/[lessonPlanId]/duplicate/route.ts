// POST /api/lesson-plans/[lessonPlanId]/duplicate — { plannedDate } — a new
// DRAFT copy preserving the ORIGINAL section/subject/staff (never re-derived
// from the duplicating actor).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { duplicateLessonPlan } from "@/lib/server/lesson-plans/service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ lessonPlanId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("lessonPlans.manage");
    const scope = await requireOrgScope(ctx);
    const { lessonPlanId } = await params;
    return ok(await duplicateLessonPlan(scope, lessonPlanId, await readJson(request)));
  });
}
