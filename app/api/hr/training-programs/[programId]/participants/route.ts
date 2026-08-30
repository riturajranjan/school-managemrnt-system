// GET  /api/hr/training-programs/[programId]/participants — hr.view or hr.manage.
// POST /api/hr/training-programs/[programId]/participants — hr.manage.
// Assigns a real, in-school Staff record (never a client-supplied identity
// trusted outright — re-validated server-side against scope.schoolId).
import type { NextRequest } from "next/server";
import { handle, requireAnyPermission, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { assignTrainingParticipant, listTrainingParticipants } from "@/lib/server/hr/training";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ programId: string }> }) {
  return handle(async () => {
    const ctx = await requireAnyPermission(["hr.view", "hr.manage"]);
    const scope = await requireOrgScope(ctx);
    const { programId } = await params;
    return ok(await listTrainingParticipants(scope, programId));
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ programId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    const { programId } = await params;
    return ok(await assignTrainingParticipant(scope, programId, await readJson(request)));
  });
}
