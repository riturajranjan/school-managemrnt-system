// GET /api/attendance/period-reports?type=subject-summary|student-subject
// — real PERIOD/subject attendance reports (separate from the DAILY reports).
// Optional filters: sectionId, classId, subjectId, dateFrom, dateTo.
// attendance.view + attendance feature.
import type { NextRequest } from "next/server";
import { handle, HttpError, requirePermission } from "@/lib/server/api/guard";
import { singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { getPeriodReport, type PeriodReportType } from "@/lib/server/attendance/reports";

const TYPES: PeriodReportType[] = ["subject-summary", "student-subject"];

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("attendance.view");
    const scope = await requireOrgScope(ctx);
    const sp = request.nextUrl.searchParams;
    const type = singleParam(sp, "type") as PeriodReportType | undefined;
    if (!type || !TYPES.includes(type)) throw new HttpError("VALIDATION_ERROR", "Unknown or missing period report type");
    return ok(await getPeriodReport(scope, {
      type,
      sectionId: singleParam(sp, "sectionId"),
      classId: singleParam(sp, "classId"),
      subjectId: singleParam(sp, "subjectId"),
      dateFrom: singleParam(sp, "dateFrom"),
      dateTo: singleParam(sp, "dateTo"),
    }));
  });
}
