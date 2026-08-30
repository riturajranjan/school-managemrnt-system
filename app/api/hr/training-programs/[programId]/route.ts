// GET   /api/hr/training-programs/[programId] — hr.view or hr.manage.
// PATCH /api/hr/training-programs/[programId] — hr.manage.
import type { NextRequest } from "next/server";
import { handle, requireAnyPermission, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getTrainingProgram, updateTrainingProgram } from "@/lib/server/hr/training";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ programId: string }> }) {
  return handle(async () => {
    const ctx = await requireAnyPermission(["hr.view", "hr.manage"]);
    const scope = await requireOrgScope(ctx);
    const { programId } = await params;
    return ok(await getTrainingProgram(scope, programId));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ programId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    const { programId } = await params;
    return ok(await updateTrainingProgram(scope, programId, await readJson(request)));
  });
}
