// POST /api/admissions/[applicationId]/stage — move an application through the
// pipeline (persisted to AdmissionStageHistory). Moving to approved/rejected is
// an approval-level action and additionally requires `admissions.approve`.
import type { NextRequest } from "next/server";
import { HttpError, handle, requirePermission } from "@/lib/server/api/guard";
import { requireOrgScope } from "@/lib/server/api/scope";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { changeStage } from "@/lib/server/admissions/service";

type Ctx = { params: Promise<{ applicationId: string }> };

const APPROVAL_STAGES = new Set(["approved", "rejected"]);

export async function POST(request: NextRequest, { params }: Ctx) {
  return handle(async () => {
    const ctx = await requirePermission("admissions.update");
    const scope = await requireOrgScope(ctx);
    const { applicationId } = await params;
    const body = await readJson(request);

    const stage = (body as { stage?: unknown } | null)?.stage;
    if (typeof stage === "string" && APPROVAL_STAGES.has(stage) && !ctx.permissions.has("admissions.approve")) {
      throw new HttpError("FORBIDDEN", "You do not have permission to approve or reject admissions.");
    }
    return ok(await changeStage(scope, applicationId, body));
  });
}
