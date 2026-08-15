// GET  /api/staff-attendance?date=YYYY-MM-DD — the ACTIVE staff roster for a
//      day with each member's marked/NOT_MARKED status. staffAttendance.view.
// POST /api/staff-attendance — mark/bulk-mark/correct (upsert). staffAttendance.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getStaffAttendanceRoster, markStaffAttendance } from "@/lib/server/staff-attendance/service";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("staffAttendance.view");
    const scope = await requireOrgScope(ctx);
    const data = await getStaffAttendanceRoster(scope, { date: singleParam(request.nextUrl.searchParams, "date") });
    return ok(data);
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("staffAttendance.manage");
    const scope = await requireOrgScope(ctx);
    await markStaffAttendance(scope, await readJson(request));
    return ok({ success: true });
  });
}
