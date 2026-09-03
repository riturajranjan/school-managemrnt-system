// GET  /api/hostel/leave — list, server-side search/filter/pagination. hostel.view.
// POST /api/hostel/leave — create a leave request for a real, in-scope resident. hostel.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { createHostelLeaveRequest, listHostelLeaveRequests } from "@/lib/server/hostel/leave";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("hostel.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "hostel");
    const sp = request.nextUrl.searchParams;
    const data = await listHostelLeaveRequests(scope, {
      status: singleParam(sp, "status"),
      studentId: singleParam(sp, "studentId"),
      hostelId: singleParam(sp, "hostelId"),
      search: singleParam(sp, "search"),
      page: singleParam(sp, "page") ? Number(singleParam(sp, "page")) : undefined,
      pageSize: singleParam(sp, "pageSize") ? Number(singleParam(sp, "pageSize")) : undefined,
    });
    return ok(data.data, data.meta);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("hostel.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "hostel");
    return ok(await createHostelLeaveRequest(scope, await readJson(request)));
  });
}
