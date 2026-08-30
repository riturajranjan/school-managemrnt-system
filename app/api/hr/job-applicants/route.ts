// GET  /api/hr/job-applicants — hr.view or hr.manage (whole-directory read).
// POST /api/hr/job-applicants — hr.manage.
import type { NextRequest } from "next/server";
import { handle, requireAnyPermission, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createJobApplicant, listJobApplicants } from "@/lib/server/hr/recruitment";
import type { JobApplicantStageDto } from "@/lib/api/contracts";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requireAnyPermission(["hr.view", "hr.manage"]);
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    return ok(
      await listJobApplicants(scope, {
        jobOpeningId: singleParam(sp, "jobOpeningId"),
        stage: singleParam(sp, "stage") as JobApplicantStageDto | undefined,
      }),
    );
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await createJobApplicant(scope, await readJson(request)));
  });
}
