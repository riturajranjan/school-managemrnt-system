// GET /api/super-admin/trials — trials (TRIALING/trial-origin subscriptions),
// paginated/filtered. Platform scope (platform.trials.view).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { parsePagination, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { listTrials, type TrialListParams } from "@/lib/server/platform/trials-service";

const SORTS = ["trialEnd", "createdAt"] as const;

export async function GET(request: NextRequest) {
  return handle(async () => {
    await requirePermission("platform.trials.view");
    const sp = request.nextUrl.searchParams;
    const { page, pageSize } = parsePagination(sp);
    const sortRaw = singleParam(sp, "sort");
    const sort = (SORTS as readonly string[]).includes(sortRaw ?? "") ? (sortRaw as TrialListParams["sort"]) : undefined;
    const { data, meta } = await listTrials({
      page,
      pageSize,
      search: singleParam(sp, "search"),
      planId: singleParam(sp, "plan") ?? singleParam(sp, "planId"),
      state: singleParam(sp, "state"),
      sort,
      order: singleParam(sp, "order") === "desc" ? "desc" : "asc",
    });
    return ok(data, meta);
  });
}
