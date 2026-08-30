// POST /api/hr/job-openings/[openingId]/status { status }
// "archived" is the delete-equivalent — a job opening is never hard-deleted. hr.manage.
import type { NextRequest } from "next/server";
import { handle, HttpError, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { JOB_OPENING_STATUS_VALUES, setJobOpeningStatus } from "@/lib/server/hr/recruitment";
import type { JobOpeningStatusDto } from "@/lib/api/contracts";

export async function POST(request: NextRequest, { params }: { params: Promise<{ openingId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    const { openingId } = await params;
    const body = (await readJson(request)) as { status?: unknown };
    if (typeof body.status !== "string" || !(JOB_OPENING_STATUS_VALUES as readonly string[]).includes(body.status)) {
      throw new HttpError("VALIDATION_ERROR", "Invalid status");
    }
    return ok(await setJobOpeningStatus(scope, openingId, body.status as JobOpeningStatusDto));
  });
}
