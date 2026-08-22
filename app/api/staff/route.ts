// GET  /api/staff — staff directory (search/status/branch/teaching/page). hr.view
// POST /api/staff — create a staff member. hr.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { createStaff, listStaff } from "@/lib/server/staff/service";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("hr.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const teaching = singleParam(sp, "teaching");
    const pageRaw = singleParam(sp, "page");
    const pageSizeRaw = singleParam(sp, "pageSize");
    return ok(await listStaff(scope, {
      search: singleParam(sp, "search"),
      status: singleParam(sp, "status"),
      branchId: singleParam(sp, "branchId"),
      teaching: teaching === undefined ? undefined : teaching === "true",
      departmentId: singleParam(sp, "departmentId"),
      designationId: singleParam(sp, "designationId"),
      sort: singleParam(sp, "sort"),
      page: pageRaw ? Number(pageRaw) : undefined,
      pageSize: pageSizeRaw ? Number(pageSizeRaw) : undefined,
    }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("hr.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await createStaff(scope, await readJson(request)));
  });
}
