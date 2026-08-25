// GET /api/transport/attendance?date=YYYY-MM-DD — real per-trip boarding/drop
// summary for one date, by route/stop/student. Read-only (marking happens on
// the trip detail page). transport.view.
import type { NextRequest } from "next/server";
import { HttpError, handle, requirePermission } from "@/lib/server/api/guard";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getAttendanceForDate } from "@/lib/server/transport/attendance";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("transport.view");
    const scope = await requireOrgScope(ctx);
    const date = request.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError("VALIDATION_ERROR", "date must be YYYY-MM-DD");
    return ok(await getAttendanceForDate(scope, date));
  });
}
