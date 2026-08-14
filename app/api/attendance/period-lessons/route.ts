// GET /api/attendance/period-lessons?sectionId=&date=YYYY-MM-DD — real scheduled
// teaching lessons for a section on a date (+ any open period session). Read
// surface: attendance.view + the attendance feature.
import type { NextRequest } from "next/server";
import { handle, HttpError, requirePermission } from "@/lib/server/api/guard";
import { singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { listPeriodLessons } from "@/lib/server/attendance/period-service";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("attendance.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const sectionId = singleParam(sp, "sectionId");
    const date = singleParam(sp, "date");
    if (!sectionId || !date) throw new HttpError("VALIDATION_ERROR", "sectionId and date are required");
    return ok(await listPeriodLessons(scope, sectionId, date));
  });
}
