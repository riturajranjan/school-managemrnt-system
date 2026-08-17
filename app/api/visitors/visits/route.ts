// GET /api/visitors/visits?status=&hostStaffId=&search=&date= — visit list. visitors.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { listVisits } from "@/lib/server/visitors/visits";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("visitors.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const data = await listVisits(scope, {
      status: singleParam(sp, "status"),
      hostStaffId: singleParam(sp, "hostStaffId"),
      search: singleParam(sp, "search"),
      date: singleParam(sp, "date"),
      page: singleParam(sp, "page") ? Number(singleParam(sp, "page")) : undefined,
      pageSize: singleParam(sp, "pageSize") ? Number(singleParam(sp, "pageSize")) : undefined,
    });
    return ok(data.data, data.meta);
  });
}
