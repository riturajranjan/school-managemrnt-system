// GET /api/academics/sections/[sectionId]/curriculum/assignable-topics?subjectId=...
// — the real CurriculumTopic list valid for a lesson plan on this section+
// subject (empty when no ACTIVE curriculum exists — an honest empty state,
// never an arbitrary topic list). curriculum.view.
import type { NextRequest } from "next/server";
import { handle, HttpError, requirePermission } from "@/lib/server/api/guard";
import { singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { listAssignableCurriculumTopics } from "@/lib/server/curriculum/service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ sectionId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("curriculum.view");
    const scope = await requireOrgScope(ctx);
    const { sectionId } = await params;
    const subjectId = singleParam(request.nextUrl.searchParams, "subjectId");
    if (!subjectId) throw new HttpError("VALIDATION_ERROR", "subjectId is required");
    return ok(await listAssignableCurriculumTopics(scope, sectionId, subjectId));
  });
}
