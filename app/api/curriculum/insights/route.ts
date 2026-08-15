// GET /api/curriculum/insights — real, DB-derived completion rollups for the
// Curriculum page's stat tiles ("Completion by class/subject/teacher",
// delayed units). Never a stored/fabricated percentage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getCurriculumInsights } from "@/lib/server/curriculum/service";

export async function GET(_request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("curriculum.view");
    const scope = await requireOrgScope(ctx);
    return ok(await getCurriculumInsights(scope));
  });
}
