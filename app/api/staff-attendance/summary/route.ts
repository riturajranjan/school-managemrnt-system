// GET /api/staff-attendance/summary?date=YYYY-MM-DD — present/absent/late/
// half-day/on-leave/not-marked counts across ACTIVE staff in scope. staffAttendance.view.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getStaffAttendanceSummary } from "@/lib/server/staff-attendance/service";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("staffAttendance.view");
    const scope = await requireOrgScope(ctx);
    const data = await getStaffAttendanceSummary(scope, { date: singleParam(request.nextUrl.searchParams, "date") });
    return ok(data);
  });
}
