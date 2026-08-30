// GET   /api/hr/shifts/[shiftId] — hr.view or hr.manage.
// PATCH /api/hr/shifts/[shiftId] — hr.manage.
import type { NextRequest } from "next/server";
import { handle, requireAnyPermission, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getShift, updateShift } from "@/lib/server/hr/shifts";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ shiftId: string }> }) {
  return handle(async () => {
    const ctx = await requireAnyPermission(["hr.view", "hr.manage"]);
    const scope = await requireOrgScope(ctx);
    const { shiftId } = await params;
    return ok(await getShift(scope, shiftId));
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ shiftId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    const { shiftId } = await params;
    return ok(await updateShift(scope, shiftId, await readJson(request)));
  });
}
