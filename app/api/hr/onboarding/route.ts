// GET  /api/hr/onboarding — hr.view or hr.manage (whole-directory read).
// POST /api/hr/onboarding — hr.manage. Direct onboarding creation for an
// existing Staff member not sourced from recruitment (recruitment's own
// conversion path is /api/hr/job-applicants/[id]/start-onboarding).
import type { NextRequest } from "next/server";
import { handle, requireAnyPermission, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createEmployeeOnboarding, listEmployeeOnboardings } from "@/lib/server/hr/onboarding";
import type { EmployeeOnboardingStatusDto } from "@/lib/api/contracts";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requireAnyPermission(["hr.view", "hr.manage"]);
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    return ok(await listEmployeeOnboardings(scope, { status: singleParam(sp, "status") as EmployeeOnboardingStatusDto | undefined }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await createEmployeeOnboarding(scope, await readJson(request)));
  });
}
