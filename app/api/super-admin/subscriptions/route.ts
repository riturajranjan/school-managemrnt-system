// GET  /api/super-admin/subscriptions — subscriptions (paginated/filtered).
// POST /api/super-admin/subscriptions — assign a plan to a school (create).
// Platform scope (platform.subscriptions.*).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { parsePagination, readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { createSubscription, listSubscriptions, type SubscriptionListParams } from "@/lib/server/platform/subscriptions-service";

const SORTS = ["createdAt", "currentPeriodEnd", "status"] as const;

export async function GET(request: NextRequest) {
  return handle(async () => {
    await requirePermission("platform.subscriptions.view");
    const sp = request.nextUrl.searchParams;
    const { page, pageSize } = parsePagination(sp);
    const sortRaw = singleParam(sp, "sort");
    const sort = (SORTS as readonly string[]).includes(sortRaw ?? "") ? (sortRaw as SubscriptionListParams["sort"]) : undefined;
    const { data, meta } = await listSubscriptions({
      page,
      pageSize,
      search: singleParam(sp, "search"),
      status: singleParam(sp, "status"),
      planId: singleParam(sp, "planId"),
      sort,
      order: singleParam(sp, "order") === "asc" ? "asc" : "desc",
    });
    return ok(data, meta);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    await requirePermission("platform.subscriptions.manage");
    const body = await readJson(request);
    return ok(await createSubscription(body));
  });
}
