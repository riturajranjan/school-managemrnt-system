// GET /api/attendance/reports — real student-attendance reports computed
// server-side (canonical summary formula). ?type= selects the report; optional
// filters: classId, sectionId (real Academics ids), dateFrom, dateTo. Read-only
// reporting surface: attendance.view + attendance feature.
import type { NextRequest } from "next/server";
import { handle, HttpError, requirePermission } from "@/lib/server/api/guard";
import { singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getReport } from "@/lib/server/attendance/reports";
import type { AttendanceReportType } from "@/lib/api/contracts";

const REPORT_TYPES: AttendanceReportType[] = ["daily", "monthly-trend", "class", "shortage", "late-arrival", "consecutive-absence"];

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("attendance.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const type = singleParam(sp, "type") as AttendanceReportType | undefined;
    if (!type || !REPORT_TYPES.includes(type)) throw new HttpError("VALIDATION_ERROR", "Unknown or missing report type");
    return ok(await getReport(scope, {
      type,
      classId: singleParam(sp, "classId"),
      sectionId: singleParam(sp, "sectionId"),
      dateFrom: singleParam(sp, "dateFrom"),
      dateTo: singleParam(sp, "dateTo"),
    }));
  });
}
