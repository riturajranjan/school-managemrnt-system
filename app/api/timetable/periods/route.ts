// GET /api/timetable/periods — the branch/session bell schedule. timetable.view.
// PUT /api/timetable/periods { periods:[...] } — atomically replace it. timetable.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { listPeriods, reconcilePeriods } from "@/lib/server/timetable/periods-service";

export async function GET() {
  return handle(async () => {
    const ctx = await requirePermission("timetable.view");
    const scope = await requireOrgScope(ctx);
    return ok(await listPeriods(scope));
  });
}

export async function PUT(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("timetable.manage");
    const scope = await requireOrgScope(ctx);
    return ok(await reconcilePeriods(scope, await readJson(request)));
  });
}
