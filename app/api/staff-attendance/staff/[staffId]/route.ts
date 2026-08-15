// GET /api/staff-attendance/staff/[staffId]?from=YYYY-MM-DD&to=YYYY-MM-DD —
// a staff member's attendance history + canonical percentage over a range.
// Self-view (own Staff.userId link) OR staffAttendance.view — enforced inside
// the service, not by a route-level permission gate.
import type { NextRequest } from "next/server";
import { handle, requireAuth } from "@/lib/server/api/guard";
import { singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getStaffAttendanceHistory, getStaffAttendancePercent } from "@/lib/server/staff-attendance/service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ staffId: string }> }) {
  return handle(async () => {
    const ctx = await requireAuth();
    const scope = await requireOrgScope(ctx);
    const { staffId } = await params;
    const sp = request.nextUrl.searchParams;
    const range = { from: singleParam(sp, "from"), to: singleParam(sp, "to") };
    const [history, percent] = await Promise.all([
      getStaffAttendanceHistory(scope, staffId, range),
      getStaffAttendancePercent(scope, staffId, range),
    ]);
    return ok({ history, percent });
  });
}
