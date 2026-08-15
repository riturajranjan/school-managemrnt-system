// GET /api/academics/sections/[sectionId]/curriculum?subjectId=... — the real
// Unit->Chapter->Topic tree for this section's class+subject curriculum, with
// per-topic progress for THIS section and a real, server-computed overall
// percentage. Returns null (not 404) when no curriculum exists yet for this
// class+subject — an honest empty state.
import type { NextRequest } from "next/server";
import { handle, HttpError, requirePermission } from "@/lib/server/api/guard";
import { singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getSectionCurriculum } from "@/lib/server/curriculum/service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ sectionId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("curriculum.view");
    const scope = await requireOrgScope(ctx);
    const { sectionId } = await params;
    const subjectId = singleParam(request.nextUrl.searchParams, "subjectId");
    if (!subjectId) throw new HttpError("VALIDATION_ERROR", "subjectId is required");
    return ok(await getSectionCurriculum(scope, sectionId, subjectId));
  });
}
