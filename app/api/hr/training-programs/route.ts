// GET  /api/hr/training-programs — hr.view or hr.manage (whole-directory read).
// POST /api/hr/training-programs — hr.manage.
import type { NextRequest } from "next/server";
import { handle, requireAnyPermission, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createTrainingProgram, listTrainingPrograms } from "@/lib/server/hr/training";
import type { TrainingProgramStatusDto } from "@/lib/api/contracts";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requireAnyPermission(["hr.view", "hr.manage"]);
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    return ok(await listTrainingPrograms(scope, { status: singleParam(sp, "status") as TrainingProgramStatusDto | undefined }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await createTrainingProgram(scope, await readJson(request)));
  });
}
