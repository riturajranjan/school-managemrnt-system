// GET /api/homework/mine — the caller's own homework, real Staff.id resolved
// server-side (never trusted from the client). Empty (not an error) for
// anyone with no real teaching Staff profile. homework.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { parsePagination, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { listMyHomework } from "@/lib/server/homework/service";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("homework.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const { page, pageSize } = parsePagination(sp);
    const { data, meta } = await listMyHomework(scope, {
      status: singleParam(sp, "status"),
      search: singleParam(sp, "search"),
      page, pageSize,
    });
    return ok(data, meta);
  });
}
