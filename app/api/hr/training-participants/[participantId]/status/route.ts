// POST /api/hr/training-participants/[participantId]/status
// { status: "in-progress"|"completed"|"cancelled", completedAt?, certificateIssued? }
// hr.manage — an employee can never mark themselves (or anyone else) complete
// via hr.viewOwn; there is no self-service mutation path here at all.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { setTrainingParticipantStatus } from "@/lib/server/hr/training";

export async function POST(request: NextRequest, { params }: { params: Promise<{ participantId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    const { participantId } = await params;
    return ok(await setTrainingParticipantStatus(scope, participantId, await readJson(request)));
  });
}
