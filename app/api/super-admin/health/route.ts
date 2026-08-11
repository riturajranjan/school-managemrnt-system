// GET /api/super-admin/health — derived tenant/school health (paginated/filtered).
// Read-only; platform.tenant_health.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { parsePagination, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { listTenantHealth, type HealthListParams } from "@/lib/server/platform/health-service";

const SORTS = ["name", "healthState"] as const;

export async function GET(request: NextRequest) {
  return handle(async () => {
    await requirePermission("platform.tenant_health.view");
    const sp = request.nextUrl.searchParams;
    const { page, pageSize } = parsePagination(sp);
    const sortRaw = singleParam(sp, "sort");
    const sort = (SORTS as readonly string[]).includes(sortRaw ?? "") ? (sortRaw as HealthListParams["sort"]) : undefined;
    const { data, meta } = await listTenantHealth({
      page,
      pageSize,
      search: singleParam(sp, "search"),
      healthState: singleParam(sp, "healthState"),
      schoolStatus: singleParam(sp, "schoolStatus"),
      subscriptionStatus: singleParam(sp, "subscriptionStatus"),
      sort,
      order: singleParam(sp, "order") === "desc" ? "desc" : "asc",
    });
    return ok(data, meta);
  });
}
