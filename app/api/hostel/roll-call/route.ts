// GET  /api/hostel/roll-call?date=YYYY-MM-DD — real roll call for all
//      currently-active residents, NOT_MARKED derived (never synthesized).
//      hostel.view.
// POST /api/hostel/roll-call — mark one resident's roll-call status for a
//      date. hostel.manage.
import type { NextRequest } from "next/server";
import { handle, requirePermission } from "@/lib/server/api/guard";
import { readJson, singleParam } from "@/lib/server/api/request";
import { ok } from "@/lib/server/api/response";
import { requireOrgScope } from "@/lib/server/api/scope";
import { requireFeature } from "@/lib/server/platform/features-service";
import { getRollCall, getStudentRollCallHistory, markRollCall } from "@/lib/server/hostel/roll-call";
import { HttpError } from "@/lib/server/api/guard";

export async function GET(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("hostel.view");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "hostel");
    const sp = request.nextUrl.searchParams;
    const studentId = singleParam(sp, "studentId");
    if (studentId) return ok(await getStudentRollCallHistory(scope, studentId));
    const date = singleParam(sp, "date");
    if (!date) throw new HttpError("VALIDATION_ERROR", "date is required");
    return ok(await getRollCall(scope, { date, hostelId: singleParam(sp, "hostelId") }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const ctx = await requirePermission("hostel.manage");
    const scope = await requireOrgScope(ctx);
    await requireFeature(scope.schoolId, "hostel");
    return ok(await markRollCall(scope, await readJson(request)));
  });
}
