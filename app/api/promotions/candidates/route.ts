// GET /api/promotions/candidates?examId=&targetAcademicSessionId=[&classId=][&sectionId=]
// Real candidates for a promotion transition: current (source-session) roster
// enriched with the published result (if any) and eligibility. promotion.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { listPromotionCandidates } from "@/lib/server/promotion/service";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("promotion.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    return ok(
      await listPromotionCandidates(scope, {
        examId: singleParam(sp, "examId"),
        targetAcademicSessionId: singleParam(sp, "targetAcademicSessionId"),
        classId: singleParam(sp, "classId"),
        sectionId: singleParam(sp, "sectionId"),
      }),
    );
  });
}
