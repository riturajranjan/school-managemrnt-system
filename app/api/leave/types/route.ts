// GET  /api/leave/types — active leave types for the school. leave.submit or leave.approve.
// POST /api/leave/types — create a leave type. leave.approve (broad manager only).
import type { NextRequest } from "next/server";
import { handle, requireAnyPermission, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createLeaveType, listLeaveTypes } from "@/lib/server/leave/service";

export async function GET() {
  return handle(async () => {
    const ctx = await requireAnyPermission(["leave.submit", "leave.approve"]);
    const scope = await requireOrgScope(ctx);
    const data = await listLeaveTypes(scope);
    return ok(data);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("leave.approve");
    const scope = await requireOrgScope(ctx);
    const data = await createLeaveType(scope, await readJson(request));
    return ok(data);
  });
}
