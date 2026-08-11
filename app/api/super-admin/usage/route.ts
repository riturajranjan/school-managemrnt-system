// GET /api/super-admin/usage — real usage vs plan limits per school
// (paginated/filtered). Read-only; platform.usage.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { parsePagination, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { listUsage, type UsageListParams } from "@/lib/server/platform/usage-service";

const SORTS = ["name", "students"] as const;

export async function GET(request: NextRequest) {
  return handle(async () => {
    await requirePermission("platform.usage.view");
    const sp = request.nextUrl.searchParams;
    const { page, pageSize } = parsePagination(sp);
    const sortRaw = singleParam(sp, "sort");
    const sort = (SORTS as readonly string[]).includes(sortRaw ?? "") ? (sortRaw as UsageListParams["sort"]) : undefined;
    const { data, meta } = await listUsage({
      page,
      pageSize,
      search: singleParam(sp, "search"),
      state: singleParam(sp, "state"),
      planId: singleParam(sp, "plan") ?? singleParam(sp, "planId"),
      sort,
      order: singleParam(sp, "order") === "desc" ? "desc" : "asc",
    });
    return ok(data, meta);
  });
}
