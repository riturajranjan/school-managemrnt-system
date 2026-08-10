// GET  /api/super-admin/plans — plan catalog (paginated/filtered).
// POST /api/super-admin/plans — create a plan. Platform scope (platform.plans.*).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { parsePagination, readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { createPlan, listPlans, type PlanListParams } from "@/lib/server/platform/plans-service";

const SORTS = ["sortOrder", "price", "name", "createdAt"] as const;

export async function GET(request: NextRequest) {
  return handle(async () => {
    await requirePermission("platform.plans.view");
    const sp = request.nextUrl.searchParams;
    const { page, pageSize } = parsePagination(sp);
    const sortRaw = singleParam(sp, "sort");
    const sort = (SORTS as readonly string[]).includes(sortRaw ?? "") ? (sortRaw as PlanListParams["sort"]) : undefined;
    const { data, meta } = await listPlans({
      page,
      pageSize,
      search: singleParam(sp, "search"),
      status: singleParam(sp, "status"),
      billingInterval: singleParam(sp, "billingInterval"),
      sort,
      order: singleParam(sp, "order") === "desc" ? "desc" : "asc",
    });
    return ok(data, meta);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    await requirePermission("platform.plans.manage");
    const body = await readJson(request);
    return ok(await createPlan(body));
  });
}
