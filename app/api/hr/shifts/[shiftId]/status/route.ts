// POST /api/hr/shifts/[shiftId]/status { status: "active"|"inactive" } — hr.manage.
import type { NextRequest } from "next/server";
import { handle, HttpError, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { setShiftStatus, SHIFT_STATUS_VALUES } from "@/lib/server/hr/shifts";
import type { ShiftStatusDto } from "@/lib/api/contracts";

export async function POST(request: NextRequest, { params }: { params: Promise<{ shiftId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    const { shiftId } = await params;
    const body = (await readJson(request)) as { status?: unknown };
    if (typeof body.status !== "string" || !(SHIFT_STATUS_VALUES as readonly string[]).includes(body.status)) {
      throw new HttpError("VALIDATION_ERROR", "Invalid status");
    }
    return ok(await setShiftStatus(scope, shiftId, body.status as ShiftStatusDto));
  });
}
