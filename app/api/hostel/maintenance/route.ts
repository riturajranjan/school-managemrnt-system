// GET  /api/hostel/maintenance — list, server-side search/filter/pagination. hostel.view.
// POST /api/hostel/maintenance — report a facility maintenance issue. hostel.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { createHostelMaintenance, listHostelMaintenance } from "@/lib/server/hostel/maintenance";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("hostel.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "hostel");
    const sp = request.nextUrl.searchParams;
    const data = await listHostelMaintenance(scope, {
      status: singleParam(sp, "status"),
      priority: singleParam(sp, "priority"),
      hostelId: singleParam(sp, "hostelId"),
      assignedStaffId: singleParam(sp, "assignedStaffId"),
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
    return ok(await createHostelMaintenance(scope, await readJson(request)));
  });
}
