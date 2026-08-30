// POST /api/hr/job-applicants/[applicantId]/stage { stage }
// Enforces the recruitment lifecycle server-side (applied → screening →
// interview → selected → hired, with reject/withdraw from any non-terminal
// stage) — an invalid jump is rejected regardless of what the client sends. hr.manage.
import type { NextRequest } from "next/server";
import { handle, HttpError, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { JOB_APPLICANT_STAGE_VALUES, setJobApplicantStage } from "@/lib/server/hr/recruitment";
import type { JobApplicantStageDto } from "@/lib/api/contracts";

export async function POST(request: NextRequest, { params }: { params: Promise<{ applicantId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    const { applicantId } = await params;
    const body = (await readJson(request)) as { stage?: unknown };
    if (typeof body.stage !== "string" || !(JOB_APPLICANT_STAGE_VALUES as readonly string[]).includes(body.stage)) {
      throw new HttpError("VALIDATION_ERROR", "Invalid stage");
    }
    return ok(await setJobApplicantStage(scope, applicantId, body.stage as JobApplicantStageDto));
  });
}
