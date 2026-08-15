// GET /api/dashboard — Main Dashboard aggregation: real attendance summary
// (canonical Phase 5B DTO), today's real timetable (teaching actors only),
// real upcoming exams. dashboard.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getDashboardSummary } from "@/lib/server/dashboard/service";

export async function GET(_request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("dashboard.view");
    const scope = await requireOrgScope(ctx);
    return ok(await getDashboardSummary(scope));
  });
}
