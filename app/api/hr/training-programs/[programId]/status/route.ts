// POST /api/hr/training-programs/[programId]/status { status }
// "archived" is the delete-equivalent — a program is never hard-deleted. hr.manage.
import type { NextRequest } from "next/server";
import { handle, HttpError, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { setTrainingProgramStatus, TRAINING_PROGRAM_STATUS_VALUES } from "@/lib/server/hr/training";
import type { TrainingProgramStatusDto } from "@/lib/api/contracts";

export async function POST(request: NextRequest, { params }: { params: Promise<{ programId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    const { programId } = await params;
    const body = (await readJson(request)) as { status?: unknown };
    if (typeof body.status !== "string" || !(TRAINING_PROGRAM_STATUS_VALUES as readonly string[]).includes(body.status)) {
      throw new HttpError("VALIDATION_ERROR", "Invalid status");
    }
    return ok(await setTrainingProgramStatus(scope, programId, body.status as TrainingProgramStatusDto));
  });
}
