// GET /api/staff/load-summary?staffIds=a,b,c — bulk per-staff teaching load
// (subjects taught, section count, real weekly periods) for the Teachers
// directory list. Same gate as the Staff/Teachers directory itself (hr.view).
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { multiParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getTeachingLoadSummary } from "@/lib/server/academics/teaching-assignments-service";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("hr.view");
    const scope = await requireOrgScope(ctx);
    const staffIds = multiParam(request.nextUrl.searchParams, "staffIds") ?? [];
    const summary = await getTeachingLoadSummary(scope, staffIds);
    return ok([...summary.values()]);
  });
}
