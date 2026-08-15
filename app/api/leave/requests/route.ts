// GET  /api/leave/requests?staffId=&status= — own requests (self-service), or
//      any request when the actor is a broad leave manager. leave.submit or leave.approve.
// POST /api/leave/requests — submit a leave request (self, or on behalf of a
//      real Staff member if the actor is a broad manager). leave.submit.
import type { NextRequest } from "next/server";
import { handle, requireAnyPermission, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createLeaveRequest, listLeaveRequests } from "@/lib/server/leave/service";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requireAnyPermission(["leave.submit", "leave.approve"]);
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const data = await listLeaveRequests(scope, { staffId: singleParam(sp, "staffId"), status: singleParam(sp, "status") });
    return ok(data);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("leave.submit");
    const scope = await requireOrgScope(ctx);
    const data = await createLeaveRequest(scope, await readJson(request));
    return ok(data);
  });
}
