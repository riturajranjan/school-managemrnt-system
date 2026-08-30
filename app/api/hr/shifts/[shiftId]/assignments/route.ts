// GET  /api/hr/shifts/[shiftId]/assignments — hr.view or hr.manage.
// POST /api/hr/shifts/[shiftId]/assignments — hr.manage. Concurrency-safe
// overlap prevention (row lock on Staff) — see lib/server/hr/shifts.ts.
import type { NextRequest } from "next/server";
import { handle, requireAnyPermission, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { assignShift, listShiftAssignments } from "@/lib/server/hr/shifts";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ shiftId: string }> }) {
  return handle(async () => {
    const ctx = await requireAnyPermission(["hr.view", "hr.manage"]);
    const scope = await requireOrgScope(ctx);
    const { shiftId } = await params;
    return ok(await listShiftAssignments(scope, shiftId));
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ shiftId: string }> }) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    const { shiftId } = await params;
    return ok(await assignShift(scope, shiftId, await readJson(request)));
  });
}
