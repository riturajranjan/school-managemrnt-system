// GET /api/hr/job-openings/summary — whole-scope openings/applicant
// aggregates for the stat tiles, independent of the list's own
// search/status/department filter and page. hr.view or hr.manage.
import { handle, requireAnyPermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getRecruitmentSummary } from "@/lib/server/hr/recruitment";

export async function GET() {
  return handle(async () => {
    const ctx = await requireAnyPermission(["hr.view", "hr.manage"]);
    const scope = await requireOrgScope(ctx);
    return ok(await getRecruitmentSummary(scope));
  });
}
