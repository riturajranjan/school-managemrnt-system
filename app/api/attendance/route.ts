// GET /api/attendance — paginated, server-filtered attendance history (register
// list). Filters: classId, sectionId, status, dateFrom, dateTo. attendance.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { parsePagination, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { listHistory } from "@/lib/server/attendance/service";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("attendance.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const { page, pageSize } = parsePagination(sp);
    const { data, meta } = await listHistory(scope, {
      page, pageSize,
      classId: singleParam(sp, "classId") ?? undefined,
      sectionId: singleParam(sp, "sectionId") ?? undefined,
      status: singleParam(sp, "status") ?? undefined,
      dateFrom: singleParam(sp, "dateFrom") ?? undefined,
      dateTo: singleParam(sp, "dateTo") ?? undefined,
    });
    return ok(data, meta);
  });
}
